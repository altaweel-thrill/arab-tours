"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  TrendingUp,
  WalletCards,
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
import { Button } from "@/components/ui/button";
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
  customerId?: string;
  orderNumber?: string;
  status?: string;
  fullAmount?: number;
  totalPrice?: number;
  paidAmount?: number;
  remainingAmount?: number;
  totalProfit?: number;
  createdAt?: any;
};

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
};

type CustomerProfile = {
  id: string;
  name?: string;
  phone?: string;
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

function displayDate(value: any) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
}

function getOrderMonth(order: SalesOrder) {
  const date = toDate(order.createdAt);
  return date ? monthValue(date) : "";
}

function getOrderAmount(order: SalesOrder) {
  return safeNum(order.fullAmount || order.totalPrice);
}

function compactStatusLabel(status?: string) {
  if (!status) return "-";
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value.includes("complete") || value.includes("confirm")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (value.includes("pending") || value.includes("progress")) {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (value.includes("cancel") || value.includes("reject")) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
  }
  return "";
}

function defaultMonthFromUrl() {
  if (typeof window === "undefined") return monthValue(new Date());
  return new URLSearchParams(window.location.search).get("month") || monthValue(new Date());
}

export default function MarketerSalesDetailsPage() {
  const params = useParams<{ id: string }>();
  const marketerId = decodeURIComponent(String(params?.id || ""));

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthFromUrl);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    const loadData = async () => {
      try {
        setLoading(true);
        const [ordersSnap, usersSnap, customersSnap] = await Promise.all([
          getDocs(collection(db, "salesOrders")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "customers")),
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
        setCustomers(
          customersSnap.docs.map((customerDoc) => ({
            id: customerDoc.id,
            ...(customerDoc.data() as Omit<CustomerProfile, "id">),
          }))
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to load marketer sales");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => unsubscribe();
  }, []);

  const marketer = useMemo(() => {
    return users.find((user) => user.id === marketerId);
  }, [marketerId, users]);

  const marketerOrders = useMemo(() => {
    return orders.filter((order) => order.createdBy === marketerId);
  }, [marketerId, orders]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(monthValue(new Date()));
    marketerOrders.forEach((order) => {
      const value = getOrderMonth(order);
      if (value) months.add(value);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [marketerOrders]);

  const monthOrders = useMemo(() => {
    return marketerOrders
      .filter((order) => getOrderMonth(order) === selectedMonth)
      .sort((a, b) => {
        const aDate = toDate(a.createdAt)?.getTime() ?? 0;
        const bDate = toDate(b.createdAt)?.getTime() ?? 0;
        return bDate - aDate;
      });
  }, [marketerOrders, selectedMonth]);

  const customersById = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]));
  }, [customers]);

  const stats = useMemo(() => {
    const totalSales = monthOrders.reduce(
      (sum, order) => sum + getOrderAmount(order),
      0
    );
    const paidAmount = monthOrders.reduce(
      (sum, order) => sum + safeNum(order.paidAmount),
      0
    );
    const remainingAmount = monthOrders.reduce(
      (sum, order) => sum + safeNum(order.remainingAmount),
      0
    );
    const totalProfit = monthOrders.reduce(
      (sum, order) => sum + safeNum(order.totalProfit),
      0
    );

    return {
      totalSales,
      paidAmount,
      remainingAmount,
      totalProfit,
      orderCount: monthOrders.length,
      averageOrder: monthOrders.length ? totalSales / monthOrders.length : 0,
      collectionRate: totalSales ? Math.round((paidAmount / totalSales) * 100) : 0,
    };
  }, [monthOrders]);

  const statusRows = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    monthOrders.forEach((order) => {
      const key = compactStatusLabel(order.status);
      const current = map.get(key) || { count: 0, amount: 0 };
      current.count += 1;
      current.amount += getOrderAmount(order);
      map.set(key, current);
    });
    return Array.from(map.entries())
      .map(([status, value]) => ({ status, ...value }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthOrders]);

  const trendRows = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let index = 5; index >= 0; index -= 1) {
      months.push(monthValue(new Date(now.getFullYear(), now.getMonth() - index, 1)));
    }

    const rows = months.map((month) => {
      const total = marketerOrders
        .filter((order) => getOrderMonth(order) === month)
        .reduce((sum, order) => sum + getOrderAmount(order), 0);
      return { month, total };
    });
    const max = Math.max(...rows.map((row) => row.total), 1);
    return rows.map((row) => ({
      ...row,
      percent: Math.max(6, Math.round((row.total / max) * 100)),
    }));
  }, [marketerOrders]);

  const marketerName = marketer?.name || marketer?.email || marketerId;

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
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/management/marketers">
                      Marketers
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{marketerName}</BreadcrumbPage>
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
                <div className="min-w-0">
                  <Button asChild variant="outline" size="sm" className="mb-3">
                    <Link href="/management/marketers">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Link>
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>Marketer Sales</span>
                  </div>
                  <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                    {marketerName}
                  </h1>
                  <div className="mt-1 truncate text-sm text-muted-foreground">
                    {marketer?.email || marketerId}
                  </div>
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <StatCard
                  title="Sales"
                  value={formatCurrency(stats.totalSales)}
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  tone="text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  title="Orders"
                  value={String(stats.orderCount)}
                  icon={<ReceiptText className="h-5 w-5" />}
                  tone="text-sky-700 bg-sky-50 dark:bg-sky-950/40"
                />
                <StatCard
                  title="Paid"
                  value={formatCurrency(stats.paidAmount)}
                  icon={<WalletCards className="h-5 w-5" />}
                  tone="text-teal-700 bg-teal-50 dark:bg-teal-950/40"
                />
                <StatCard
                  title="Remaining"
                  value={formatCurrency(stats.remainingAmount)}
                  icon={<Clock3 className="h-5 w-5" />}
                  tone="text-amber-700 bg-amber-50 dark:bg-amber-950/40"
                />
                <StatCard
                  title="Profit"
                  value={formatCurrency(stats.totalProfit)}
                  icon={<TrendingUp className="h-5 w-5" />}
                  tone="text-violet-700 bg-violet-50 dark:bg-violet-950/40"
                />
                <StatCard
                  title="Collection"
                  value={`${stats.collectionRate}%`}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  tone="text-lime-700 bg-lime-50 dark:bg-lime-950/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Card className="border bg-background shadow-sm">
                  <CardHeader className="border-b bg-muted/20 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Six Month Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex h-52 items-end gap-3">
                      {trendRows.map((row) => (
                        <div key={row.month} className="flex h-full flex-1 flex-col justify-end gap-2">
                          <div className="text-center text-xs font-medium text-muted-foreground">
                            {formatCurrency(row.total)}
                          </div>
                          <div className="flex flex-1 items-end rounded-md bg-muted/30 px-2">
                            <div
                              className="w-full rounded-t-md bg-primary"
                              style={{ height: `${row.percent}%` }}
                            />
                          </div>
                          <div className="text-center text-xs text-muted-foreground">
                            {row.month.slice(5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border bg-background shadow-sm">
                  <CardHeader className="border-b bg-muted/20 px-4 py-3">
                    <CardTitle className="text-base">Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {statusRows.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No orders in {monthLabel(selectedMonth)}.
                      </div>
                    ) : (
                      statusRows.map((row) => {
                        const percent = stats.totalSales
                          ? Math.round((row.amount / stats.totalSales) * 100)
                          : 0;

                        return (
                          <div key={row.status} className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={statusTone(row.status)}>
                                  {row.status}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {row.count} orders
                                </span>
                              </div>
                              <div className="font-medium">
                                {formatCurrency(row.amount)}
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${Math.max(percent, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border bg-background shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      Orders - {monthLabel(selectedMonth)}
                    </CardTitle>
                    <Badge variant="secondary">{monthOrders.length} orders</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading sales...
                    </div>
                  ) : monthOrders.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No orders found for this month.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 text-right font-medium">Total</th>
                            <th className="px-4 py-3 text-right font-medium">Paid</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Remaining
                            </th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthOrders.map((order) => {
                            const customer = order.customerId
                              ? customersById.get(order.customerId)
                              : null;

                            return (
                              <tr key={order.id} className="border-b hover:bg-muted/20 last:border-0">
                                <td className="px-4 py-4 align-top font-medium">
                                  {order.orderNumber || order.id}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="font-medium">
                                    {customer?.name || "-"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {customer?.phone || order.customerId || "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <Badge variant="outline" className={statusTone(order.status)}>
                                    {compactStatusLabel(order.status)}
                                  </Badge>
                                </td>
                                <td className="px-4 py-4 text-right align-top font-semibold">
                                  {formatCurrency(getOrderAmount(order))}
                                </td>
                                <td className="px-4 py-4 text-right align-top text-emerald-600">
                                  {formatCurrency(safeNum(order.paidAmount))}
                                </td>
                                <td className="px-4 py-4 text-right align-top text-amber-600">
                                  {formatCurrency(safeNum(order.remainingAmount))}
                                </td>
                                <td className="px-4 py-4 align-top text-muted-foreground">
                                  {displayDate(order.createdAt)}
                                </td>
                                <td className="px-4 py-4 text-right align-top">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/sales/orders/${order.id}`}>
                                      Open
                                    </Link>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card className="border bg-background shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 truncate text-xl font-semibold">{value}</div>
        </div>
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
