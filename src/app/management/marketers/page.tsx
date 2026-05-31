"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  Award,
  CalendarDays,
  CircleDollarSign,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { AppSidebar } from "@/components/app-sidebar";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

type SalesOrder = {
  id: string;
  createdBy?: string | null;
  orderNumber?: string;
  status?: string;
  fullAmount?: number;
  totalPrice?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  privileges?: Record<string, boolean>;
};

function safeNum(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function monthValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getOrderMonth(order: SalesOrder) {
  const date = toDate(order.createdAt);
  return date ? monthValue(date) : "";
}

function getOrderAmount(order: SalesOrder) {
  return safeNum(order.fullAmount || order.totalPrice);
}

function isSalesUser(user: UserProfile, hasOrders: boolean) {
  const role = String(user.role || "").toLowerCase();
  return (
    hasOrders ||
    role.includes("sales") ||
    user.privileges?.["sales.view"] ||
    user.privileges?.["sales.add"] ||
    user.privileges?.["sales.report"]
  );
}

export default function ManagementMarketersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => monthValue(new Date()));
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    const loadData = async () => {
      try {
        setLoading(true);
        const [ordersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "salesOrders")),
          getDocs(collection(db, "users")),
        ]);

        setOrders(
          ordersSnap.docs.map((orderDoc) => ({
            id: orderDoc.id,
            ...(orderDoc.data() as Omit<SalesOrder, "id">),
          }))
        );
        setUsers(
          usersSnap.docs.map((userDoc) => ({
            id: userDoc.id,
            ...(userDoc.data() as Omit<UserProfile, "id">),
          }))
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to load marketers sales");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => unsubscribe();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(monthValue(new Date()));
    orders.forEach((order) => {
      const value = getOrderMonth(order);
      if (value) months.add(value);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const monthOrders = useMemo(() => {
    return orders.filter((order) => getOrderMonth(order) === selectedMonth);
  }, [orders, selectedMonth]);

  const marketerRows = useMemo(() => {
    const orderCreatorIds = new Set(
      orders.map((order) => order.createdBy).filter(Boolean) as string[]
    );
    const usersById = new Map(users.map((user) => [user.id, user]));
    const marketerIds = new Set<string>();

    users.forEach((user) => {
      if (isSalesUser(user, orderCreatorIds.has(user.id))) {
        marketerIds.add(user.id);
      }
    });
    orderCreatorIds.forEach((id) => marketerIds.add(id));

    return Array.from(marketerIds)
      .map((marketerId) => {
        const marketerOrders = monthOrders.filter(
          (order) => order.createdBy === marketerId
        );
        const totalSales = marketerOrders.reduce(
          (sum, order) => sum + getOrderAmount(order),
          0
        );
        const paidAmount = marketerOrders.reduce(
          (sum, order) => sum + safeNum(order.paidAmount),
          0
        );
        const remainingAmount = marketerOrders.reduce(
          (sum, order) => sum + safeNum(order.remainingAmount),
          0
        );
        const user = usersById.get(marketerId);

        return {
          id: marketerId,
          name: user?.name || user?.email || marketerId,
          email: user?.email,
          role: user?.role,
          orderCount: marketerOrders.length,
          totalSales,
          paidAmount,
          remainingAmount,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales || b.orderCount - a.orderCount);
  }, [monthOrders, orders, users]);

  const overview = useMemo(() => {
    const totalSales = marketerRows.reduce((sum, row) => sum + row.totalSales, 0);
    const totalOrders = marketerRows.reduce((sum, row) => sum + row.orderCount, 0);
    const activeMarketers = marketerRows.filter((row) => row.orderCount > 0).length;
    const topMarketer = marketerRows[0];

    return {
      totalSales,
      totalOrders,
      activeMarketers,
      topMarketer,
    };
  }, [marketerRows]);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="management.sales-view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/management">Management</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Marketers</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell userId={currentUser?.uid ?? " "} />
              <ThemeToggle />
            </div>
          </header>

          <div className="min-h-screen bg-muted/10">
            <div className="space-y-5 p-4 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Management</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                    Marketers Monthly Sales
                  </h1>
                </div>

                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="month-filter" className="text-xs text-muted-foreground">
                      Month
                    </Label>
                    <Input
                      id="month-filter"
                      type="month"
                      className="h-9 w-[160px]"
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                    />
                  </div>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  >
                    {availableMonths.map((month) => (
                      <option key={month} value={month}>
                        {monthLabel(month)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          Month Sales
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {formatCurrency(overview.totalSales)}
                        </div>
                      </div>
                      <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          Orders
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {overview.totalOrders}
                        </div>
                      </div>
                      <ReceiptText className="h-5 w-5 text-sky-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          Active Marketers
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {overview.activeMarketers}
                        </div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          Top Marketer
                        </div>
                        <div className="mt-1 truncate text-xl font-semibold">
                          {overview.topMarketer?.name || "-"}
                        </div>
                      </div>
                      <Award className="h-5 w-5 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  <Card className="border bg-background shadow-sm md:col-span-2 xl:col-span-3">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      Loading marketers...
                    </CardContent>
                  </Card>
                ) : marketerRows.length === 0 ? (
                  <Card className="border bg-background shadow-sm md:col-span-2 xl:col-span-3">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No marketers found.
                    </CardContent>
                  </Card>
                ) : (
                  marketerRows.map((marketer, index) => (
                    <Link
                      key={marketer.id}
                      href={`/management/marketers/${encodeURIComponent(
                        marketer.id
                      )}?month=${selectedMonth}`}
                      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Card className="h-full overflow-hidden border bg-background shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/10">
                        <CardHeader className="border-b bg-muted/20 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-base">
                                {marketer.name}
                              </CardTitle>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {marketer.email || marketer.id}
                              </div>
                            </div>
                            <Badge variant={index === 0 ? "default" : "secondary"}>
                              #{index + 1}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {monthLabel(selectedMonth)}
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                              {formatCurrency(marketer.totalSales)}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="rounded-md border bg-muted/10 p-2">
                              <div className="text-xs text-muted-foreground">
                                Orders
                              </div>
                              <div className="mt-1 font-semibold">
                                {marketer.orderCount}
                              </div>
                            </div>
                            <div className="rounded-md border bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <div className="text-xs opacity-80">Paid</div>
                              <div className="mt-1 truncate font-semibold">
                                {formatCurrency(marketer.paidAmount)}
                              </div>
                            </div>
                            <div className="rounded-md border bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              <div className="text-xs opacity-80">Remaining</div>
                              <div className="mt-1 truncate font-semibold">
                                {formatCurrency(marketer.remainingAmount)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
