"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { BarChart3, CalendarDays, DollarSign, Receipt } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

type SalesOrder = {
  id: string;
  status?: string;
  totalPrice?: number;
  totalProfit?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

type MonthlyReport = {
  monthKey: string;
  monthLabel: string;
  orders: number;
  revenue: number;
  profit: number;
  paid: number;
  remaining: number;
};

function toDate(value: any) {
  if (!value) return null;

  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesReportsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const loadOrders = async () => {
      try {
        setLoading(true);

        const ordersQuery = query(
          collection(db, "salesOrders"),
          where("createdBy", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(ordersQuery);
        setOrders(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SalesOrder[]
        );
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.uid]);

  const monthlyReports = useMemo(() => {
    const map = new Map<string, MonthlyReport>();

    orders.forEach((order) => {
      const date = toDate(order.createdAt);
      if (!date) return;

      const monthKey = format(date, "yyyy-MM");
      const existing =
        map.get(monthKey) ??
        ({
          monthKey,
          monthLabel: format(date, "MMM yyyy"),
          orders: 0,
          revenue: 0,
          profit: 0,
          paid: 0,
          remaining: 0,
        } satisfies MonthlyReport);

      existing.orders += 1;
      existing.revenue += Number(order.totalPrice || 0);
      existing.profit += Number(order.totalProfit || 0);
      existing.paid += Number(order.paidAmount || 0);
      existing.remaining += Number(order.remainingAmount || 0);

      map.set(monthKey, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );
  }, [orders]);

  const totals = useMemo(() => {
    return monthlyReports.reduce(
      (acc, month) => ({
        orders: acc.orders + month.orders,
        revenue: acc.revenue + month.revenue,
        profit: acc.profit + month.profit,
        paid: acc.paid + month.paid,
      }),
      { orders: 0, revenue: 0, profit: 0, paid: 0 }
    );
  }, [monthlyReports]);

  const latestMonth = monthlyReports[monthlyReports.length - 1];

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.report">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div>
                <h2 className="font-semibold">Sales Reports</h2>
                <p className="text-xs text-muted-foreground">
                  Monthly performance for your sales orders
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard
                title="Total Revenue"
                value={formatCurrency(totals.revenue)}
                icon={<DollarSign className="h-4 w-4" />}
              />
              <SummaryCard
                title="Total Profit"
                value={formatCurrency(totals.profit)}
                icon={<BarChart3 className="h-4 w-4" />}
              />
              <SummaryCard
                title="Orders"
                value={formatNumber(totals.orders)}
                icon={<Receipt className="h-4 w-4" />}
              />
              <SummaryCard
                title="Latest Month"
                value={latestMonth?.monthLabel ?? "-"}
                icon={<CalendarDays className="h-4 w-4" />}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Sales</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                    Loading reports...
                  </div>
                ) : monthlyReports.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                    No sales orders found.
                  </div>
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={monthlyReports}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="monthLabel"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          tickFormatter={(value) => formatNumber(Number(value))}
                        />
                        <Legend />
                        <Tooltip
                          formatter={(value, name) => [
                            formatCurrency(Number(value)),
                            name === "revenue" ? "Revenue" : "Profit",
                          ]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#2563eb"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Loading reports...
                        </TableCell>
                      </TableRow>
                    ) : monthlyReports.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No monthly data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyReports
                        .slice()
                        .reverse()
                        .map((month) => (
                          <TableRow key={month.monthKey}>
                            <TableCell className="font-medium">
                              {month.monthLabel}
                            </TableCell>
                            <TableCell>{formatNumber(month.orders)}</TableCell>
                            <TableCell>
                              {formatCurrency(month.revenue)}
                            </TableCell>
                            <TableCell className="text-emerald-600">
                              {formatCurrency(month.profit)}
                            </TableCell>
                            <TableCell>{formatCurrency(month.paid)}</TableCell>
                            <TableCell>
                              {formatCurrency(month.remaining)}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
