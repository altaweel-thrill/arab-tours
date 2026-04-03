"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
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

import {
  Users,
  Briefcase,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
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
  BarChart,
  Bar,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

/* ----------------------------- Helpers ----------------------------- */

function toTS(date: Date) {
  return Timestamp.fromDate(date);
}

function safeNum(n: number | undefined | null) {
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

type SimpleDoc = {
  id: string;
  name?: string;
  createdAt?: any;
  total?: number;
  status?: string;
};

type MiniSeriesPoint = { day: string; value: number };

/* ----------------------------- Component ----------------------------- */

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // cards
  const [customersCount, setCustomersCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [packagesCount, setPackagesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // deltas (month-over-month)
  const [customersDelta, setCustomersDelta] = useState(0);
  const [salesDelta, setSalesDelta] = useState(0);
  const [packagesDelta, setPackagesDelta] = useState(0);
  const [revenueDelta, setRevenueDelta] = useState(0);

  // mini charts (last 7 days)
  const [miniCustomers, setMiniCustomers] = useState<MiniSeriesPoint[]>([]);
  const [miniSales, setMiniSales] = useState<MiniSeriesPoint[]>([]);
  const [miniPackages, setMiniPackages] = useState<MiniSeriesPoint[]>([]);
  const [miniRevenue, setMiniRevenue] = useState<MiniSeriesPoint[]>([]);

  // main 30-day sales chart
  const [sales30, setSales30] = useState<{ day: string; count: number }[]>([]);

  // latest lists
  const [latestCustomers, setLatestCustomers] = useState<SimpleDoc[]>([]);
  const [latestPackages, setLatestPackages] = useState<SimpleDoc[]>([]);
  const [latestSales, setLatestSales] = useState<SimpleDoc[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

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

        const packagesCountSnap = await getCountFromServer(
          query(collection(db, "packages"))
        );

        const salesCountSnap = await getCountFromServer(
          query(collection(db, "sales"))
        );

        setCustomersCount(customersCountSnap.data().count);
        setPackagesCount(packagesCountSnap.data().count);
        setSalesCount(salesCountSnap.data().count);

        // ---------- Revenue ----------
        const salesForRevenueSnap = await getDocs(
          query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(1000))
        );
        const revenueSum = salesForRevenueSnap.docs.reduce((acc, d) => {
          const val = d.data()?.total;
          return acc + (typeof val === "number" ? val : 0);
        }, 0);
        setRevenue(revenueSum);

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

        const salesThisMonthSnap = await getCountFromServer(
          query(collection(db, "sales"), where("createdAt", ">=", toTS(thisMonthStart)))
        );
        const salesPrevMonthSnap = await getCountFromServer(
          query(
            collection(db, "sales"),
            where("createdAt", ">=", toTS(prevMonthStart)),
            where("createdAt", "<=", toTS(prevMonthEnd))
          )
        );
        setSalesDelta(
          percentDelta(
            salesThisMonthSnap.data().count,
            salesPrevMonthSnap.data().count
          )
        );

        const pkgThisMonthSnap = await getCountFromServer(
          query(collection(db, "packages"), where("createdAt", ">=", toTS(thisMonthStart)))
        );
        const pkgPrevMonthSnap = await getCountFromServer(
          query(
            collection(db, "packages"),
            where("createdAt", ">=", toTS(prevMonthStart)),
            where("createdAt", "<=", toTS(prevMonthEnd))
          )
        );
        setPackagesDelta(
          percentDelta(
            pkgThisMonthSnap.data().count,
            pkgPrevMonthSnap.data().count
          )
        );

        const revThisMonthSnap = await getDocs(
          query(
            collection(db, "sales"),
            where("createdAt", ">=", toTS(thisMonthStart)),
            orderBy("createdAt", "desc"),
            limit(1000)
          )
        );
        const revPrevMonthSnap = await getDocs(
          query(
            collection(db, "sales"),
            where("createdAt", ">=", toTS(prevMonthStart)),
            where("createdAt", "<=", toTS(prevMonthEnd)),
            orderBy("createdAt", "desc"),
            limit(1000)
          )
        );
        const revThis = sumTotals(revThisMonthSnap);
        const revPrev = sumTotals(revPrevMonthSnap);
        setRevenueDelta(percentDelta(revThis, revPrev));

        // ---------- Mini charts ----------
        setMiniCustomers(
          await buildMiniSeries("customers", day7Ago, now, false, user.uid)
        );
        setMiniSales(await buildMiniSeries("sales", day7Ago, now));
        setMiniPackages(await buildMiniSeries("packages", day7Ago, now));
        setMiniRevenue(await buildMiniSeries("sales", day7Ago, now, true));

        // ---------- 30-day Sales line chart ----------
        setSales30(await buildDailyCounts("sales", day30Ago, now));

        // ---------- Latest lists ----------
        const latestCustSnap = await getDocs(
          query(
            collection(db, "customers"),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(5)
          )
        );
        setLatestCustomers(
          latestCustSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SimpleDoc[]
        );

        const latestPkgSnap = await getDocs(
          query(collection(db, "packages"), orderBy("createdAt", "desc"), limit(5))
        );
        setLatestPackages(
          latestPkgSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SimpleDoc[]
        );

        const latestSalesSnap = await getDocs(
          query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(5))
        );
        setLatestSales(
          latestSalesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SimpleDoc[]
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

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

          <div className="min-h-screen p-6 bg-gradient-to-b from-muted/40 to-background">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {loading ? (
                <>
                  <GlassCardSkeleton />
                  <GlassCardSkeleton />
                  <GlassCardSkeleton />
                  <GlassCardSkeleton />
                </>
              ) : (
                <>
                  <StatCard
                    title="Customers"
                    value={customersCount}
                    delta={customersDelta}
                    href="/sales/customers"
                    icon={<Users className="w-6 h-6" />}
                    accent="bg-[#3B82F6]"
                    miniData={miniCustomers}
                  />
                  <StatCard
                    title="Sales"
                    value={salesCount}
                    delta={salesDelta}
                    href="/sales"
                    icon={<Briefcase className="w-6 h-6" />}
                    accent="bg-[#8B5CF6]"
                    miniData={miniSales}
                  />
                  <StatCard
                    title="Packages"
                    value={packagesCount}
                    delta={packagesDelta}
                    href="/sales/packages"
                    icon={<Package className="w-6 h-6" />}
                    accent="bg-[#F97316]"
                    miniData={miniPackages}
                  />
                  <StatCard
                    title="Revenue"
                    value={formatCurrency(revenue)}
                    delta={revenueDelta}
                    href="/sales"
                    icon={<DollarSign className="w-6 h-6" />}
                    accent="bg-[#10B981]"
                    miniData={miniRevenue}
                  />
                </>
              )}
            </div>

            <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg mb-6">
              <CardHeader className="pb-0">
                <CardTitle>Sales Overview (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <Skeleton className="w-full h-[260px] rounded-xl" />
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sales30}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
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
                title="Latest Packages"
                loading={loading}
                rows={latestPackages.map((p) => ({
                  c1: p.name ?? "-",
                  c2: p.createdAt?.seconds
                    ? format(new Date(p.createdAt.seconds * 1000), "yyyy-MM-dd")
                    : "-",
                  href: `/sales/packages/${p.id}`,
                }))}
                headers={["Package", "Created"]}
              />
              <GlassTable
                title="Latest Sales"
                loading={loading}
                rows={latestSales.map((s) => ({
                  c1: s.id,
                  c2: s.createdAt?.seconds
                    ? format(new Date(s.createdAt.seconds * 1000), "yyyy-MM-dd")
                    : "-",
                  c3: typeof s.total === "number" ? formatCurrency(s.total) : "-",
                  href: `/sales/${s.id}`,
                }))}
                headers={["Sale ID", "Created", "Total"]}
              />
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
    <Link href={href}>
      <Card className="border-0 bg-white/60 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 transition-colors backdrop-blur-xl shadow-lg rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-xl text-white ${accent}`}>{icon}</div>
            <div
              className={`flex items-center gap-1 text-sm ${
                isUp ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isUp ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(delta).toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold leading-tight">{value}</p>
          </div>

          <div className="mt-3 h-[48px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniData}>
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
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
    <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg rounded-2xl">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="rounded-lg border bg-background">
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
                    <TableRow key={i} className="hover:bg-accent/30">
                      <TableCell className="font-medium">
                        {r.href ? <Link href={r.href}>{r.c1}</Link> : r.c1}
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

function GlassCardSkeleton() {
  return (
    <Card className="border-0 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-12 w-full" />
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
  coll: "customers" | "sales" | "packages",
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
      const val = typeof d.data().total === "number" ? d.data().total : 0;
      map.set(key, safeNum(map.get(key)) + val);
    } else {
      map.set(key, safeNum(map.get(key)) + 1);
    }
  });

  return Array.from(map.entries()).map(([day, value]) => ({ day, value }));
}

async function buildDailyCounts(
  coll: "sales",
  from: Date,
  to: Date
): Promise<{ day: string; count: number }[]> {
  const q = query(
    collection(db, coll),
    where("createdAt", ">=", toTS(startOfDay(from))),
    where("createdAt", "<=", toTS(endOfDay(to))),
    orderBy("createdAt", "asc")
  );
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

function sumTotals(snap: any) {
  return snap.docs.reduce((acc: number, d: any) => {
    const v = d.data()?.total;
    return acc + (typeof v === "number" ? v : 0);
  }, 0);
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
}