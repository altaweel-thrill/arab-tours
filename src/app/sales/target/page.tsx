"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Goal,
  ReceiptText,
  Target,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { AppSidebar } from "@/components/app-sidebar";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

type SalesOrder = {
  id: string;
  orderNumber?: string;
  status?: string;
  fullAmount?: number;
  totalPrice?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

type CommissionTier = {
  id: string;
  minSales: number;
  rate: number;
};

type CommissionPlan = {
  employeeId: string;
  month: string;
  targetAmount: number;
  currency?: string;
  tiers?: CommissionTier[];
};

const defaultTiers: CommissionTier[] = [
  { id: "tier-1", minSales: 0, rate: 1 },
  { id: "tier-2", minSales: 50000, rate: 2 },
  { id: "tier-3", minSales: 100000, rate: 3 },
];

function safeNum(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function monthValue(date: Date) {
  return format(date, "yyyy-MM");
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function orderMonth(order: SalesOrder) {
  const date = toDate(order.createdAt);
  return date ? monthValue(date) : "";
}

function orderAmount(order: SalesOrder) {
  return safeNum(order.fullAmount || order.totalPrice);
}

function normalizeTiers(tiers?: CommissionTier[]) {
  return (tiers?.length ? tiers : defaultTiers)
    .map((tier, index) => ({
      id: tier.id || `tier-${index + 1}`,
      minSales: safeNum(tier.minSales),
      rate: safeNum(tier.rate),
    }))
    .sort((a, b) => a.minSales - b.minSales);
}

function currentTier(tiers: CommissionTier[], sales: number) {
  return (
    tiers
      .filter((tier) => sales >= tier.minSales)
      .sort((a, b) => b.minSales - a.minSales)[0] ||
    tiers[0] ||
    null
  );
}

function nextTier(tiers: CommissionTier[], sales: number) {
  return tiers.find((tier) => tier.minSales > sales) || null;
}

function compactStatusLabel(status?: string) {
  if (!status) return "-";
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SalesTargetPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [plan, setPlan] = useState<CommissionPlan | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => monthValue(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [ordersSnap, planSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "salesOrders"),
              where("createdBy", "==", user.uid),
              orderBy("createdAt", "desc")
            )
          ),
          getDoc(doc(db, "salesCommissionPlans", `${user.uid}_${selectedMonth}`)),
        ]);

        setOrders(
          ordersSnap.docs.map((orderDoc) => ({
            id: orderDoc.id,
            ...(orderDoc.data() as Omit<SalesOrder, "id">),
          }))
        );
        setPlan(planSnap.exists() ? (planSnap.data() as CommissionPlan) : null);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load target");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, user?.uid]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(monthValue(new Date()));
    orders.forEach((order) => {
      const value = orderMonth(order);
      if (value) months.add(value);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const monthOrders = useMemo(() => {
    return orders.filter((order) => orderMonth(order) === selectedMonth);
  }, [orders, selectedMonth]);

  const tiers = useMemo(() => normalizeTiers(plan?.tiers), [plan?.tiers]);

  const stats = useMemo(() => {
    const sales = monthOrders.reduce((sum, order) => sum + orderAmount(order), 0);
    const paid = monthOrders.reduce(
      (sum, order) => sum + safeNum(order.paidAmount),
      0
    );
    const remaining = monthOrders.reduce(
      (sum, order) => sum + safeNum(order.remainingAmount),
      0
    );
    const target = safeNum(plan?.targetAmount);
    const tier = currentTier(tiers, sales);
    const next = nextTier(tiers, sales);
    const commission = tier ? (sales * safeNum(tier.rate)) / 100 : 0;
    const progress = target ? Math.min(100, Math.round((sales / target) * 100)) : 0;

    return {
      sales,
      paid,
      remaining,
      target,
      tier,
      next,
      commission,
      progress,
      orders: monthOrders.length,
    };
  }, [monthOrders, plan?.targetAmount, tiers]);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div>
                <h2 className="font-semibold">Target</h2>
                <p className="text-xs text-muted-foreground">
                  Your monthly sales target and commission tier
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="min-h-screen bg-muted/10">
            <div className="space-y-5 p-4 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>Sales</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                    My Target
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  title="Target"
                  value={stats.target ? formatCurrency(stats.target) : "Not set"}
                  icon={<Goal className="h-5 w-5" />}
                  tone="bg-violet-50 text-violet-700 dark:bg-violet-950/40"
                />
                <SummaryCard
                  title="Sales"
                  value={formatCurrency(stats.sales)}
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                />
                <SummaryCard
                  title="Orders"
                  value={String(stats.orders)}
                  icon={<ReceiptText className="h-5 w-5" />}
                  tone="bg-sky-50 text-sky-700 dark:bg-sky-950/40"
                />
                <SummaryCard
                  title="Commission"
                  value={formatCurrency(stats.commission)}
                  icon={<BadgeDollarSign className="h-5 w-5" />}
                  tone="bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                />
                <SummaryCard
                  title="Progress"
                  value={`${stats.progress}%`}
                  icon={<TrendingUp className="h-5 w-5" />}
                  tone="bg-teal-50 text-teal-700 dark:bg-teal-950/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border bg-background shadow-sm">
                  <CardHeader className="border-b bg-muted/20 px-4 py-3">
                    <CardTitle className="text-base">
                      {monthLabel(selectedMonth)} Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 p-4">
                    {loading ? (
                      <div className="py-8 text-sm text-muted-foreground">
                        Loading target...
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Target Achievement
                            </span>
                            <span className="font-semibold">{stats.progress}%</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted">
                            <div
                              className="h-3 rounded-full bg-primary"
                              style={{ width: `${stats.progress}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatCurrency(stats.sales)} of{" "}
                            {stats.target ? formatCurrency(stats.target) : "no target"}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <InfoBox label="Paid" value={formatCurrency(stats.paid)} />
                          <InfoBox
                            label="Remaining"
                            value={formatCurrency(stats.remaining)}
                          />
                        </div>

                        {!plan ? (
                          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                            No target has been assigned for this month.
                          </div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border bg-background shadow-sm">
                  <CardHeader className="border-b bg-muted/20 px-4 py-3">
                    <CardTitle className="text-base">Commission Tier</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <div className="rounded-md border bg-muted/10 p-3">
                      <div className="text-xs text-muted-foreground">Current Tier</div>
                      <div className="mt-1 text-lg font-semibold">
                        {stats.tier
                          ? `${stats.tier.rate}% after ${formatCurrency(
                              stats.tier.minSales
                            )}`
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/10 p-3">
                      <div className="text-xs text-muted-foreground">Next Tier</div>
                      <div className="mt-1 text-lg font-semibold">
                        {stats.next
                          ? `${formatCurrency(stats.next.minSales)} / ${
                              stats.next.rate
                            }%`
                          : "Top tier"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {tiers.map((tier, index) => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {stats.tier?.id === tier.id ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Clock3 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>Tier {index + 1}</span>
                          </div>
                          <Badge variant="secondary">
                            {formatCurrency(tier.minSales)} / {tier.rate}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border bg-background shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Monthly Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading orders...
                    </div>
                  ) : monthOrders.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No orders in this month.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 text-right font-medium">Total</th>
                            <th className="px-4 py-3 text-right font-medium">Paid</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Remaining
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthOrders.map((order) => (
                            <tr key={order.id} className="border-b last:border-0">
                              <td className="px-4 py-3 font-medium">
                                {order.orderNumber || order.id}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">
                                  {compactStatusLabel(order.status)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold">
                                {formatCurrency(orderAmount(order))}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-600">
                                {formatCurrency(safeNum(order.paidAmount))}
                              </td>
                              <td className="px-4 py-3 text-right text-amber-600">
                                {formatCurrency(safeNum(order.remainingAmount))}
                              </td>
                            </tr>
                          ))}
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

function SummaryCard({
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
