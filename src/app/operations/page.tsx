"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import NotificationsBell from "@/components/notifications/NotificationsBell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  RefreshCcw,
  UserRound,
  XCircle,
} from "lucide-react";

/* ---------------- Types ---------------- */

type SalesOrder = {
  id: string;
  customerId: string;
  createdBy?: string | null;
  assignedTo?: string | null; // (اختياري) لو بدك تسند للموظف
  status: "pending" | "in_progress" | "completed" | "cancelled" | string;
  createdAt?: any;
  totalPrice?: number;
  totalProfit?: number;
};

type CustomerMini = {
  id: string;
  name?: string;
  phone?: string;
};

type Service = {
  id: string;
  type: string;
  description?: string;
  price?: number;
  profit?: number;
  visaSnapshot?: any;
};

/* ---------------- Helpers ---------------- */

function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function formatSAR(n: number) {
  // تنسيق بسيط بالريال
  return `${Math.round(n).toLocaleString("en-US")} SAR`;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (s === "in_progress") return <Badge>In Progress</Badge>;
  if (s === "completed") return <Badge className="bg-emerald-600">Completed</Badge>;
  if (s === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">{status || "-"}</Badge>;
}

/* ---------------- Page ---------------- */

export default function OperationsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  // raw data
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, Service[]>>({});
  const [customersMap, setCustomersMap] = useState<Record<string, CustomerMini>>({});

  // filters
  const [qText, setQText] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [serviceType, setServiceType] = useState<string>("all");
  const [myOnly, setMyOnly] = useState<boolean>(false);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // ✅ آخر 200 طلب (لتفادي مشاكل index قدر الإمكان)
      const qOrders = query(
        collection(db, "salesOrders"),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const snap = await getDocs(qOrders);
      const ordersData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SalesOrder[];
      setOrders(ordersData);

      // 1) customers map (unique)
      const uniqueCustomerIds = Array.from(new Set(ordersData.map((o) => o.customerId).filter(Boolean)));

      const customersPairs = await Promise.all(
        uniqueCustomerIds.map(async (cid) => {
          try {
            const cSnap = await getDoc(doc(db, "customers", cid));
            if (!cSnap.exists()) return [cid, { id: cid, name: "-", phone: "-" }] as const;
            const data = cSnap.data() as any;
            return [cid, { id: cid, name: data?.name ?? "-", phone: data?.phone ?? "-" }] as const;
          } catch {
            return [cid, { id: cid, name: "-", phone: "-" }] as const;
          }
        })
      );

      setCustomersMap(Object.fromEntries(customersPairs));

      // 2) services map لكل order
      const svcObj: Record<string, Service[]> = {};
      await Promise.all(
        ordersData.map(async (o) => {
          try {
            const sSnap = await getDocs(collection(db, "salesOrders", o.id, "services"));
            svcObj[o.id] = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Service[];
          } catch {
            svcObj[o.id] = [];
          }
        })
      );

      setServicesMap(svcObj);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load operations dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();

    return orders.filter((o) => {
      // my only (لو assignedTo موجود)
      if (myOnly && o.assignedTo && user?.uid && o.assignedTo !== user.uid) return false;

      // status
      if (status !== "all" && (o.status || "").toLowerCase() !== status) return false;

      // service type
      if (serviceType !== "all") {
        const types = (servicesMap[o.id] || []).map((x) => (x.type || "").toLowerCase());
        if (!types.includes(serviceType)) return false;
      }

      // search
      if (!s) return true;

      const cust = customersMap[o.customerId];
      const custName = (cust?.name || "").toLowerCase();
      const custPhone = (cust?.phone || "").toLowerCase();

      const svcHit =
        (servicesMap[o.id] || []).some(
          (x) =>
            (x.type || "").toLowerCase().includes(s) ||
            (x.description || "").toLowerCase().includes(s)
        );

      const statusHit = (o.status || "").toLowerCase().includes(s);

      return custName.includes(s) || custPhone.includes(s) || svcHit || statusHit;
    });
  }, [qText, orders, status, serviceType, myOnly, servicesMap, customersMap, user?.uid]);

  const kpis = useMemo(() => {
    const list = filtered;

    const pending = list.filter((o) => (o.status || "").toLowerCase() === "pending").length;
    const inProgress = list.filter((o) => (o.status || "").toLowerCase() === "in_progress").length;
    const completed = list.filter((o) => (o.status || "").toLowerCase() === "completed").length;
    const cancelled = list.filter((o) => (o.status || "").toLowerCase() === "cancelled").length;

    const totalCollection = list.reduce((a, o) => a + safeNum(o.totalPrice), 0);
    const totalProfit = list.reduce((a, o) => a + safeNum(o.totalProfit), 0);

    return {
      pending,
      inProgress,
      completed,
      cancelled,
      totalCollection,
      totalProfit,
      ordersCount: list.length,
    };
  }, [filtered]);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="operations.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <div className="font-semibold">Operations</div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="p-6 space-y-5 max-w-7xl">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <KpiCard title="Orders" value={kpis.ordersCount} icon={<Briefcase className="w-5 h-5" />} />
              <KpiCard title="Pending" value={kpis.pending} icon={<Clock className="w-5 h-5" />} />
              <KpiCard title="In Progress" value={kpis.inProgress} icon={<UserRound className="w-5 h-5" />} />
              <KpiCard title="Completed" value={kpis.completed} icon={<CheckCircle2 className="w-5 h-5" />} />
              <KpiCard title="Cancelled" value={kpis.cancelled} icon={<XCircle className="w-5 h-5" />} />
              <KpiCard title="Collection" value={formatSAR(kpis.totalCollection)} icon={<Briefcase className="w-5 h-5" />} />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>Operations Queue</span>
                  <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Filters Row (كلها بنفس السطر) */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative w-full md:max-w-sm">
                      <Input
                        placeholder="Search customer / phone / service / status..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        className="pl-10"
                      />
                      <Filter className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    </div>

                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="flight">Flight</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={myOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMyOnly((v) => !v)}
                      title="Show only tasks assigned to me"
                    >
                      <UserRound className="w-4 h-4 mr-2" />
                      My Tasks
                    </Button>
                  </div>
                </div>

                {/* Summary row: collection + profit + orders count */}
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-lg border bg-muted/20 p-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total Collection:</span>{" "}
                    <span className="font-semibold">{formatSAR(kpis.totalCollection)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total Profit:</span>{" "}
                    <span className="font-semibold text-emerald-600">{formatSAR(kpis.totalProfit)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Orders Count:</span>{" "}
                    <span className="font-semibold">{kpis.ordersCount}</span>
                  </div>
                </div>

                {/* Table */}
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <div className="rounded-xl border bg-background overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Profit</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                              No orders found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map((o) => {
                            const cust = customersMap[o.customerId];
                            const services = servicesMap[o.id] || [];
                            const svcLabel =
                              services.length === 0
                                ? "-"
                                : services
                                    .map((s) => s.type)
                                    .filter(Boolean)
                                    .slice(0, 3)
                                    .join(", ") + (services.length > 3 ? "…" : "");

                            return (
                              <TableRow key={o.id} className="hover:bg-accent/30">
                                <TableCell className="font-medium">
                                  {cust?.name || "Customer"}
                                </TableCell>
                                <TableCell>{cust?.phone || "-"}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {o.createdAt?.seconds
                                    ? format(new Date(o.createdAt.seconds * 1000), "yyyy-MM-dd")
                                    : "-"}
                                </TableCell>
                                <TableCell>{statusBadge(o.status)}</TableCell>
                                <TableCell className="text-muted-foreground">{svcLabel}</TableCell>
                                <TableCell>{formatSAR(safeNum(o.totalPrice))}</TableCell>
                                <TableCell className="text-emerald-600">
                                  {formatSAR(safeNum(o.totalProfit))}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/sales/orders/${o.id}`)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Optional quick links */}
                <div className="text-sm text-muted-foreground">
                  Tip: Make sure you have a page at{" "}
                  <Link className="underline" href="/sales/orders">
                    /sales/orders
                  </Link>{" "}
                  and order details at{" "}
                 <span className="underline">/sales/orders/[id]</span>                  .
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

/* ---------------- Small UI ---------------- */

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">{icon}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
        <div className="mt-2 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}