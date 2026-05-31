"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { LoadingProgress } from "@/components/loading-progrss";

import {
  Users,
  Briefcase,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  ClipboardList,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  startOfMonth,
  endOfDay as dfEndOfDay,
  subMonths,
} from "date-fns";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

/* ----------------------------- Helpers ----------------------------- */

function toTS(date: Date) {
  return Timestamp.fromDate(date);
}

function safeNum(n: unknown) {
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SimpleDoc = {
  id: string;
  orderNumber?: string;
  name?: string;
  createdAt?: any;
  total?: number;
  totalPrice?: number;
  fullAmount?: number;
  paidAmount?: number;
  status?: string;
};

type MiniSeriesPoint = { day: string; value: number };

/* ----------------------------- Component ----------------------------- */

export default function DashboardPage() {
  const { user, role, privileges, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const normalizedRole = (role || "").toLowerCase().trim();
  const isAccountingRole = ["accountant", "accounting", "acounting"].includes(
    normalizedRole
  );
  const shouldShowAccounting =
    isAccountingRole || (privileges?.["accounting.view"] && !privileges?.["sales.view"]);

  useEffect(() => {
    if (authLoading || !user || !shouldShowAccounting) return;
    router.replace("/accounting");
  }, [authLoading, router, shouldShowAccounting, user]);

  // cards
  const [customersCount, setCustomersCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);

  // deltas (month-over-month)
  const [customersDelta, setCustomersDelta] = useState(0);
  const [salesDelta, setSalesDelta] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState(0);

  // mini charts (last 7 days)
  const [miniCustomers, setMiniCustomers] = useState<MiniSeriesPoint[]>([]);
  const [miniSales, setMiniSales] = useState<MiniSeriesPoint[]>([]);
  const [miniRevenue, setMiniRevenue] = useState<MiniSeriesPoint[]>([]);

  // main 30-day sales chart
  const [sales30, setSales30] = useState<{ day: string; count: number }[]>([]);

  // latest lists
  const [latestCustomers, setLatestCustomers] = useState<SimpleDoc[]>([]);
  const [latestSales, setLatestSales] = useState<SimpleDoc[]>([]);

  useEffect(() => {
    if (!user?.uid || shouldShowAccounting) return;

    (async () => {
      try {
        const now = new Date();
        const day30Ago = startOfDay(subDays(now, 29));
        const day7Ago = startOfDay(subDays(now, 6));

        const thisMonthStart = startOfMonth(now);
        const prevMonthStart = startOfMonth(subMonths(now, 1));
        const prevMonthEnd = dfEndOfDay(subDays(thisMonthStart, 1));

        // ---------- Counts ----------
        const customersCountSnap = await getCountFromServer(
          query(
            collection(db, "customers"),
            where("createdBy", "==", user.uid)
          )
        );

        const salesOrdersSnap = await getDocs(
          query(
            collection(db, "salesOrders"),
            where("createdBy", "==", user.uid),
            limit(1000)
          )
        );
        const salesOrders = salesOrdersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SimpleDoc[];

        setCustomersCount(customersCountSnap.data().count);
        setSalesCount(salesOrders.length);

        // ---------- Revenue ----------
        const revenueSum = salesOrders.reduce(
          (acc, order) => acc + orderRevenue(order),
          0
        );
        setRevenue(revenueSum);

        const currentMonthKey = format(now, "yyyy-MM");
        const targetSnap = await getDoc(
          doc(db, "salesCommissionPlans", `${user.uid}_${currentMonthKey}`)
        );
        setTargetAmount(
          targetSnap.exists() ? safeNum(targetSnap.data().targetAmount) : 0
        );

        // ---------- Month-over-month deltas ----------
        const custThisMonthSnap = await getCountFromServer(
          query(
            collection(db, "customers"),
            where("createdBy", "==", user.uid),
            where("createdAt", ">=", toTS(thisMonthStart))
          )
        );

        const custPrevMonthSnap = await getCountFromServer(
          query(
            collection(db, "customers"),
            where("createdBy", "==", user.uid),
            where("createdAt", ">=", toTS(prevMonthStart)),
            where("createdAt", "<=", toTS(prevMonthEnd))
          )
        );

        setCustomersDelta(
          percentDelta(
            custThisMonthSnap.data().count,
            custPrevMonthSnap.data().count
          )
        );

        const salesThisMonth = docsInRange(salesOrders, thisMonthStart, now);
        const salesPrevMonth = docsInRange(salesOrders, prevMonthStart, prevMonthEnd);
        setSalesDelta(
          percentDelta(salesThisMonth.length, salesPrevMonth.length)
        );

        const revThis = sumOrders(salesThisMonth);
        const revPrev = sumOrders(salesPrevMonth);
        setMonthlySales(revThis);
        setRevenueDelta(percentDelta(revThis, revPrev));

        // ---------- Mini charts ----------
        setMiniCustomers(
          await buildMiniSeries("customers", day7Ago, now, false, user.uid)
        );
        setMiniSales(buildMiniSeriesFromDocs(salesOrders, day7Ago, now));
        setMiniRevenue(buildMiniSeriesFromDocs(salesOrders, day7Ago, now, true));

        // ---------- 30-day Sales line chart ----------
        setSales30(buildDailyCountsFromDocs(salesOrders, day30Ago, now));

        // ---------- Latest lists ----------
        const latestCustSnap = await getDocs(
          query(
            collection(db, "customers"),
            where("createdBy", "==", user.uid),
            limit(50)
          )
        );
        setLatestCustomers(
          (latestCustSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as SimpleDoc[])
            .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
            .slice(0, 5)
        );

        setLatestSales(
          salesOrders
            .slice()
            .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
            .slice(0, 5)
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [shouldShowAccounting, user?.uid]);

  if (authLoading || shouldShowAccounting) {
    return <LoadingProgress />;
  }

  const targetProgress = targetAmount
    ? Math.min(100, Math.round((monthlySales / targetAmount) * 100))
    : 0;

  return (
    <ProtectedRouteWithPrivilege>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? " "} />
              <ThemeToggle />
            </div>
          </header>

          <div className="min-h-screen bg-muted/20">
            <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
              <section className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {format(new Date(), "EEEE, MMMM d")}
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
                    Sales Dashboard
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Track customers, sales orders, target progress, and revenue from one place.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/sales/customers/add">
                      <Plus className="h-4 w-4" />
                      New Customer
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/sales">
                      <ClipboardList className="h-4 w-4" />
                      Sales Orders
                    </Link>
                  </Button>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                <>
                  <DashboardCardSkeleton />
                  <DashboardCardSkeleton />
                  <DashboardCardSkeleton />
                  <DashboardCardSkeleton />
                </>
              ) : (
                <>
                  <StatCard
                    title="Customers"
                    value={customersCount}
                    delta={customersDelta}
                    href="/sales/customers"
                    icon={<Users className="w-6 h-6" />}
                    accent="bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    miniData={miniCustomers}
                  />
                  <StatCard
                    title="Sales Orders"
                    value={salesCount}
                    delta={salesDelta}
                    href="/sales"
                    icon={<Briefcase className="w-6 h-6" />}
                    accent="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                    miniData={miniSales}
                  />
                  <StatCard
                    title="Target"
                    value={targetAmount ? `${targetProgress}%` : "No target"}
                    delta={0}
                    href="/sales/target"
                    icon={<Target className="w-6 h-6" />}
                    accent="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    miniData={miniRevenue}
                  />
                  <StatCard
                    title="Revenue"
                    value={formatCurrency(revenue)}
                    delta={revenueDelta}
                    href="/sales"
                    icon={<DollarSign className="w-6 h-6" />}
                    accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    miniData={miniRevenue}
                  />
                </>
              )}
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <Card className="border bg-background shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        Sales Overview
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last 30 days order activity
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {loading ? (
                      <Skeleton className="h-[280px] w-full rounded-md" />
                    ) : (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sales30} margin={{ left: -20, right: 12, top: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="day"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={10}
                              fontSize={12}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 8,
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--background))",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#0EA5E9"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border bg-background shadow-sm">
                  <CardHeader className="border-b px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Today Focus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <FocusRow label="Customers" value={customersCount} href="/sales/customers" />
                    <FocusRow label="Sales Orders" value={salesCount} href="/sales" />
                    <FocusRow
                      label="Target"
                      value={targetAmount ? `${targetProgress}%` : "Not set"}
                      href="/sales/target"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <GlassTable
                  title="Latest Customers"
                  loading={loading}
                  rows={latestCustomers.map((c) => ({
                    c1: c.name ?? "-",
                    c2: c.createdAt?.seconds
                      ? format(new Date(c.createdAt.seconds * 1000), "yyyy-MM-dd")
                      : "-",
                    href: `/sales/customers/${c.id}`,
                  }))}
                  headers={["Name", "Created"]}
                />
                <GlassTable
                  title="Target Status"
                  loading={loading}
                  rows={[
                    {
                      c1: "Monthly Target",
                      c2: targetAmount ? formatCurrency(targetAmount) : "Not set",
                      href: "/sales/target",
                    },
                    {
                      c1: "Month Sales",
                      c2: formatCurrency(monthlySales),
                      href: "/sales",
                    },
                    {
                      c1: "Progress",
                      c2: targetAmount ? `${targetProgress}%` : "0%",
                      href: "/sales/target",
                    },
                  ]}
                  headers={["Metric", "Value"]}
                />
                <GlassTable
                  title="Latest Sales"
                  loading={loading}
                  rows={latestSales.map((s) => ({
                    c1: s.orderNumber || s.id,
                    c2: s.createdAt?.seconds
                      ? format(new Date(s.createdAt.seconds * 1000), "yyyy-MM-dd")
                      : "-",
                    c3: formatCurrency(orderRevenue(s)),
                    href: `/sales/orders/${s.id}`,
                  }))}
                  headers={["Order ID", "Created", "Revenue"]}
                />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

/* ----------------------------- UI Blocks ----------------------------- */

function StatCard({
  title,
  value,
  delta,
  href,
  icon,
  accent,
  miniData,
}: {
  title: string;
  value: number | string;
  delta: number;
  href: string;
  icon: React.ReactNode;
  accent: string;
  miniData: MiniSeriesPoint[];
}) {
  const isUp = delta >= 0;
  return (
    <Link href={href} className="group">
      <Card className="h-full border bg-background shadow-sm transition-colors group-hover:border-sky-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={`rounded-md p-2 ${accent}`}>{icon}</div>
            <div className={`flex items-center gap-1 text-xs font-medium ${
              isUp ? "text-emerald-600" : "text-rose-600"
            }`}>
              {isUp ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{Math.abs(delta).toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
            </div>
            <div className="h-12 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={miniData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={isUp ? "#10B981" : "#F43F5E"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FocusRow({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </Link>
  );
}

function GlassTable({
  title,
  loading,
  headers,
  rows,
}: {
  title: string;
  loading: boolean;
  headers: string[];
  rows: { c1: string; c2: string; c3?: string; href?: string }[];
}) {
  return (
    <Card className="border bg-background shadow-sm">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={headers.length}
                      className="text-center text-muted-foreground py-8"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        {r.href ? (
                          <Link className="hover:text-sky-600" href={r.href}>
                            {r.c1}
                          </Link>
                        ) : (
                          r.c1
                        )}
                      </TableCell>
                      <TableCell>{r.c2}</TableCell>
                      {headers.length > 2 && <TableCell>{r.c3 ?? "-"}</TableCell>}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardCardSkeleton() {
  return (
    <Card className="border bg-background shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Data builders ----------------------------- */

function percentDelta(current: number, previous: number) {
  if (previous <= 0 && current > 0) return 100;
  if (previous === 0 && current === 0) return 0;
  return ((current - previous) / previous) * 100;
}

async function buildMiniSeries(
  coll: "customers" | "salesOrders" | "packages",
  from: Date,
  to: Date,
  sumTotals = false,
  createdBy?: string
): Promise<MiniSeriesPoint[]> {
  const constraints: QueryConstraint[] = [
    where("createdAt", ">=", toTS(startOfDay(from))),
    where("createdAt", "<=", toTS(endOfDay(to))),
   orderBy("createdAt", "desc")
  ];

  if (createdBy) {
    constraints.unshift(where("createdBy", "==", createdBy));
  }

  const q = query(collection(db, coll), ...constraints);
  const snap = await getDocs(q);

  const days = eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) });
  const map = new Map<string, number>();
  days.forEach((d) => map.set(format(d, "MM-dd"), 0));

  snap.docs.forEach((d) => {
    const dt = d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt);
    const key = format(startOfDay(dt), "MM-dd");
    if (!map.has(key)) map.set(key, 0);

    if (sumTotals) {
      map.set(key, safeNum(map.get(key)) + orderRevenue(d.data()));
    } else {
      map.set(key, safeNum(map.get(key)) + 1);
    }
  });

  return Array.from(map.entries()).map(([day, value]) => ({ day, value }));
}

async function buildDailyCounts(
  coll: "salesOrders",
  from: Date,
  to: Date,
  createdBy?: string
): Promise<{ day: string; count: number }[]> {
  const constraints: QueryConstraint[] = [
    where("createdAt", ">=", toTS(startOfDay(from))),
    where("createdAt", "<=", toTS(endOfDay(to))),
    orderBy("createdAt", "asc"),
  ];

  if (createdBy) {
    constraints.unshift(where("createdBy", "==", createdBy));
  }

  const q = query(collection(db, coll), ...constraints);
  const snap = await getDocs(q);

  const days = eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) });
  const map = new Map<string, number>();
  days.forEach((d) => map.set(format(d, "MM-dd"), 0));

  snap.docs.forEach((d) => {
    const dt = d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt);
    const key = format(startOfDay(dt), "MM-dd");
    map.set(key, safeNum(map.get(key)) + 1);
  });

  return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
}

function buildMiniSeriesFromDocs(
  docs: SimpleDoc[],
  from: Date,
  to: Date,
  sumRevenue = false
) {
  const days = eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) });
  const map = new Map<string, number>();
  days.forEach((d) => map.set(format(d, "MM-dd"), 0));

  docsInRange(docs, from, to).forEach((doc) => {
    const date = docDate(doc.createdAt);
    if (!date) return;

    const key = format(startOfDay(date), "MM-dd");
    const value = sumRevenue ? orderRevenue(doc) : 1;
    map.set(key, safeNum(map.get(key)) + value);
  });

  return Array.from(map.entries()).map(([day, value]) => ({ day, value }));
}

function buildDailyCountsFromDocs(docs: SimpleDoc[], from: Date, to: Date) {
  const days = eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) });
  const map = new Map<string, number>();
  days.forEach((d) => map.set(format(d, "MM-dd"), 0));

  docsInRange(docs, from, to).forEach((doc) => {
    const date = docDate(doc.createdAt);
    if (!date) return;

    const key = format(startOfDay(date), "MM-dd");
    map.set(key, safeNum(map.get(key)) + 1);
  });

  return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
}

function docsInRange(docs: SimpleDoc[], from: Date, to: Date) {
  const fromMs = startOfDay(from).getTime();
  const toMs = endOfDay(to).getTime();

  return docs.filter((doc) => {
    const value = timestampMs(doc.createdAt);
    return value >= fromMs && value <= toMs;
  });
}

function sumOrders(orders: SimpleDoc[]) {
  return orders.reduce((acc, order) => acc + orderRevenue(order), 0);
}

function orderRevenue(order: any) {
  return safeNum(order?.fullAmount ?? order?.totalPrice ?? order?.total);
}

function timestampMs(value: any) {
  return docDate(value)?.getTime() ?? 0;
}

function docDate(value: any) {
  if (!value) return null;
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value.toDate === "function") return value.toDate();

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} SAR`;
  }
}
