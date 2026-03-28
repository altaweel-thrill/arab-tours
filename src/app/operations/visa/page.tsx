"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
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
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  RefreshCcw,
  UserRound,
  XCircle,
  Hand,
  UserCheck,
  X,
} from "lucide-react";

/* ---------------- Types ---------------- */

type SalesOrder = {
  id: string;
  customerId: string;
  createdBy?: string | null;
  assignedTo?: string | null;
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
  return `${Math.round(n).toLocaleString("en-US")} SAR`;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (s === "in_progress") return <Badge>In Progress</Badge>;
  if (s === "completed")
    return <Badge className="bg-emerald-600">Completed</Badge>;
  if (s === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">{status || "-"}</Badge>;
}

function hasVisaService(services: Service[]) {
  return (services || []).some((s) => (s.type || "").toLowerCase() === "visa");
}

/* ---------------- Page ---------------- */

export default function VisaOperationsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // raw data
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, Service[]>>({});
  const [customersMap, setCustomersMap] = useState<Record<string, CustomerMini>>(
    {}
  );

  // filters
  const [qText, setQText] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [myOnly, setMyOnly] = useState<boolean>(false);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const qOrders = query(
        collection(db, "salesOrders"),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const snap = await getDocs(qOrders);
      const ordersData = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as SalesOrder[];

      // services map
      const svcObj: Record<string, Service[]> = {};
      await Promise.all(
        ordersData.map(async (o) => {
          try {
            const sSnap = await getDocs(
              collection(db, "salesOrders", o.id, "services")
            );
            svcObj[o.id] = sSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            })) as Service[];
          } catch {
            svcObj[o.id] = [];
          }
        })
      );

      setServicesMap(svcObj);

      // ✅ Visa only
      const visaOnlyOrders = ordersData.filter((o) =>
        hasVisaService(svcObj[o.id] || [])
      );
      setOrders(visaOnlyOrders);

      // customers map
      const uniqueCustomerIds = Array.from(
        new Set(visaOnlyOrders.map((o) => o.customerId).filter(Boolean))
      );

      const customersPairs = await Promise.all(
        uniqueCustomerIds.map(async (cid) => {
          try {
            const cSnap = await getDoc(doc(db, "customers", cid));
            if (!cSnap.exists())
              return [cid, { id: cid, name: "-", phone: "-" }] as const;
            const data = cSnap.data() as any;
            return [
              cid,
              { id: cid, name: data?.name ?? "-", phone: data?.phone ?? "-" },
            ] as const;
          } catch {
            return [cid, { id: cid, name: "-", phone: "-" }] as const;
          }
        })
      );

      setCustomersMap(Object.fromEntries(customersPairs));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load visa operations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ---------------- Assign / Release ---------------- */

  const acceptOrder = async (orderId: string) => {
    if (!user?.uid) return;
    try {
      setAssigningId(orderId);

      await updateDoc(doc(db, "salesOrders", orderId), {
        assignedTo: user.uid,
        status: "in_progress", // ✅ عند الاستلام
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      toast.success("Order assigned to you");
      // تحديث سريع محلي + إعادة تحميل
      await fetchAll();
      setMyOnly(true); // ✅ خليها تظهر في My Tasks مباشرة
    } catch (e) {
      console.error(e);
      toast.error("Failed to accept order");
    } finally {
      setAssigningId(null);
    }
  };

  const releaseOrder = async (orderId: string) => {
    if (!user?.uid) return;
    try {
      setAssigningId(orderId);

      await updateDoc(doc(db, "salesOrders", orderId), {
        assignedTo: null,
        status: "pending", // ✅ يرجع انتظار
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      toast.success("Order released");
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("Failed to release order");
    } finally {
      setAssigningId(null);
    }
  };

  /* ---------------- Filtering ---------------- */

  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();

    return orders.filter((o) => {
      // my only
      if (myOnly && user?.uid) {
        if ((o.assignedTo || "") !== user.uid) return false;
      }

      // status
      if (status !== "all" && (o.status || "").toLowerCase() !== status)
        return false;

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
        ) ?? false;

      const statusHit = (o.status || "").toLowerCase().includes(s);

      return custName.includes(s) || custPhone.includes(s) || svcHit || statusHit;
    });
  }, [qText, orders, status, myOnly, servicesMap, customersMap, user?.uid]);

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
              <div className="font-semibold">Visa Operations</div>
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
                  <span>Visa Queue</span>
                  <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Filters Row */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative w-full md:max-w-sm">
                      <Input
                        placeholder="Search customer / phone / visa / status..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        className="pl-10"
                      />
                      <Filter className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>
                        All
                      </Button>
                      <Button size="sm" variant={status === "pending" ? "default" : "outline"} onClick={() => setStatus("pending")}>
                        Pending
                      </Button>
                      <Button size="sm" variant={status === "in_progress" ? "default" : "outline"} onClick={() => setStatus("in_progress")}>
                        In Progress
                      </Button>
                      <Button size="sm" variant={status === "completed" ? "default" : "outline"} onClick={() => setStatus("completed")}>
                        Completed
                      </Button>
                      <Button size="sm" variant={status === "cancelled" ? "default" : "outline"} onClick={() => setStatus("cancelled")}>
                        Cancelled
                      </Button>
                    </div>
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

                {/* Summary */}
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
                          <TableHead>Visa Services</TableHead>
                          <TableHead>Assigned</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                              No visa orders found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map((o) => {
                            const cust = customersMap[o.customerId];
                            const services = (servicesMap[o.id] || []).filter(
                              (s) => (s.type || "").toLowerCase() === "visa"
                            );

                            const svcLabel =
                              services.length === 0
                                ? "-"
                                : services
                                    .map((s) => s.description || "Visa")
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join(" | ") + (services.length > 2 ? "…" : "");

                            const isMine = !!user?.uid && o.assignedTo === user.uid;
                            const isAssigned = !!o.assignedTo;

                            return (
                              <TableRow key={o.id} className="hover:bg-accent/30">
                                <TableCell className="font-medium">{cust?.name || "Customer"}</TableCell>
                                <TableCell>{cust?.phone || "-"}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {o.createdAt?.seconds
                                    ? format(new Date(o.createdAt.seconds * 1000), "yyyy-MM-dd")
                                    : "-"}
                                </TableCell>
                                <TableCell>{statusBadge(o.status)}</TableCell>
                                <TableCell className="text-muted-foreground">{svcLabel}</TableCell>

                                <TableCell>
                                  {isMine ? (
                                    <Badge className="bg-emerald-600">Mine</Badge>
                                  ) : isAssigned ? (
                                    <Badge variant="outline">Assigned</Badge>
                                  ) : (
                                    <Badge variant="secondary">Unassigned</Badge>
                                  )}
                                </TableCell>

                                <TableCell>{formatSAR(safeNum(o.totalPrice))}</TableCell>

                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {/* ✅ Accept */}
                                    {!isAssigned && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        disabled={assigningId === o.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          acceptOrder(o.id);
                                        }}
                                      >
                                        <Hand className="w-4 h-4 mr-2" />
                                        {assigningId === o.id ? "Accepting..." : "Accept"}
                                      </Button>
                                    )}

                                    {/* ✅ Release (اختياري) */}
                                    {isMine && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={assigningId === o.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          releaseOrder(o.id);
                                        }}
                                        title="Release back to queue"
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Release
                                      </Button>
                                    )}

                                    {/* Details */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/sales/orders/${o.id}`);
                                      }}
                                    >
                                      <Eye className="w-4 h-4 " />
                                    
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Tip: Click <span className="font-semibold">Accept</span> to assign the order to yourself, then enable{" "}
                  <span className="font-semibold">My Tasks</span>.
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