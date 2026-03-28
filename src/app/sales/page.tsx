"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ButtonGroup } from "@/components/ui/button-group"

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

import {
  ChevronDown,
  ChevronRight,
  Eye,
  Search,
} from "lucide-react";
import React from "react";

/* ---------------- Types ---------------- */

type Order = {
  id: string;
  customerId: string;
  status: string;
  totalPrice: number;
  totalProfit: number;
  createdAt?: any;
};

type Service = {
  id: string;
  type: string;
  description: string;
  price: number;
  profit: number;
};

type CustomerInfo = {
  name: string;
  phone: string;
};

/* ---------------- Page ---------------- */

export default function MySalesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, Service[]>>({});
  const [customers, setCustomers] = useState<Record<string, CustomerInfo>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);

  /* ---------------- Fetch ---------------- */

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const q = query(
          collection(db, "salesOrders"),
          where("createdBy", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const ordersData = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Order[];

        setOrders(ordersData);

        // Customers
        const map: Record<string, CustomerInfo> = {};
        const uniqueIds = Array.from(
          new Set(ordersData.map((o) => o.customerId))
        );

        await Promise.all(
          uniqueIds.map(async (cid) => {
            const cSnap = await getDoc(doc(db, "customers", cid));
            if (cSnap.exists()) {
              map[cid] = {
                name: cSnap.data().name,
                phone: cSnap.data().phone,
              };
            }
          })
        );
        setCustomers(map);

        // Services
        const servicesObj: Record<string, Service[]> = {};
        for (const o of ordersData) {
          const sSnap = await getDocs(
            collection(db, "salesOrders", o.id, "services")
          );
          servicesObj[o.id] = sSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Service[];
        }
        setServicesMap(servicesObj);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  /* ---------------- Presets ---------------- */

  const preset = (type: string) => {
    const now = new Date();

    if (type === "today") {
      setFromDate(format(now, "yyyy-MM-dd"));
      setToDate(format(now, "yyyy-MM-dd"));
    }

    if (type === "7") {
      setFromDate(format(subDays(now, 7), "yyyy-MM-dd"));
      setToDate(format(now, "yyyy-MM-dd"));
    }

    if (type === "30") {
      setFromDate(format(subDays(now, 30), "yyyy-MM-dd"));
      setToDate(format(now, "yyyy-MM-dd"));
    }

    if (type === "month") {
      setFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(now), "yyyy-MM-dd"));
    }

    if (type === "prevMonth") {
      const prev = subMonths(now, 1);
      setFromDate(format(startOfMonth(prev), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(prev), "yyyy-MM-dd"));
    }
  };

  /* ---------------- Filters ---------------- */

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const customer = customers[o.customerId]?.name?.toLowerCase() || "";
      const phone = customers[o.customerId]?.phone || "";
      const text = `${customer} ${phone} ${o.status}`.toLowerCase();

      const matchesSearch = !search || text.includes(search.toLowerCase());

      const date = o.createdAt?.seconds
        ? new Date(o.createdAt.seconds * 1000)
        : null;

      const matchesFrom = !fromDate || (date && date >= new Date(fromDate));
      const matchesTo =
        !toDate ||
        (date && date <= new Date(`${toDate}T23:59:59`));

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [orders, customers, search, fromDate, toDate]);

  /* ---------------- Totals ---------------- */

  const totals = useMemo(() => {
    const total = filteredOrders.reduce((a, o) => a + o.totalPrice, 0);
    const profit = filteredOrders.reduce((a, o) => a + o.totalProfit, 0);
    return {
      total,
      profit,
      count: filteredOrders.length,
    };
  }, [filteredOrders]);

  /* ---------------- Render ---------------- */

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Daily Sales Report</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="p-6 space-y-4 max-w-7xl">
           {/* Filters Row */}
<div className="flex flex-wrap items-center gap-2 justify-between">
  {/* Left: Presets */}
  <div className="flex flex-wrap gap-2">
    <ButtonGroup>

    <Button size="sm" variant="outline" onClick={() => preset("today")}>Today</Button>
    <Button size="sm" variant="outline" onClick={() => preset("7")}>7D</Button>
    <Button size="sm" variant="outline" onClick={() => preset("30")}>30D</Button>
    <Button size="sm" variant="outline" onClick={() => preset("month")}>This Month</Button>
    <Button size="sm" variant="outline" onClick={() => preset("prevMonth")}>Prev Month</Button>
 </ButtonGroup>

  </div>

  {/* Right: Search + Dates */}
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative w-64">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    <Input
      type="date"
      className="w-36"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
    />

    <Input
      type="date"
      className="w-36"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
    />
  </div>
</div>
            {/* Totals */}
            <Card>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 font-medium">
                <div>Total Collection: {totals.total} SAR</div>
                <div className="text-emerald-600">Total Profit: {totals.profit} SAR</div>
                <div>Orders Count: {totals.count}</div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Orders</CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead />
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredOrders.map((o) => {
                        const isOpen = openRow === o.id;
                        return (
                          <React.Fragment key={o.id}>
                            <TableRow onClick={() => setOpenRow(isOpen ? null : o.id)}>
                              <TableCell>
                                {isOpen ? <ChevronDown /> : <ChevronRight />}
                              </TableCell>
                              <TableCell>{customers[o.customerId]?.name}</TableCell>
                              <TableCell>{customers[o.customerId]?.phone}</TableCell>
                              <TableCell>
                                {o.createdAt?.seconds
                                  ? format(new Date(o.createdAt.seconds * 1000), "yyyy-MM-dd")
                                  : "-"}
                              </TableCell>
                              <TableCell>{o.totalPrice}</TableCell>
                              <TableCell className="text-emerald-600">{o.totalProfit}</TableCell>
                              <TableCell>{o.status}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" onClick={() => router.push(`/sales/orders/${o.id}`)}>
                                  <Eye className="w-4 h-4 mr-1" /> Details
                                </Button>
                              </TableCell>
                            </TableRow>

                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30">
                                  <div className="p-3 space-y-2">
                                    {servicesMap[o.id]?.map((s) => (
                                      <div key={s.id} className="grid grid-cols-5 gap-3 border rounded p-2 text-sm bg-background">
                                        <div>{s.type}</div>
                                        <div className="col-span-2 text-muted-foreground">{s.description}</div>
                                        <div>{s.price} SAR</div>
                                        <div className="text-emerald-600">{s.profit} SAR</div>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}