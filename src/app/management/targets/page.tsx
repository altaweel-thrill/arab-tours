"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  BadgeDollarSign,
  CalendarDays,
  CircleDollarSign,
  Goal,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  fullAmount?: number;
  totalPrice?: number;
  totalProfit?: number;
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

type CommissionTier = {
  id: string;
  minSales: number;
  rate: number;
};

type CommissionPlan = {
  id: string;
  employeeId: string;
  month: string;
  targetAmount: number;
  currency: string;
  tiers: CommissionTier[];
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

function planId(employeeId: string, month: string) {
  return `${employeeId}_${month}`;
}

function normalizeTiers(tiers: CommissionTier[]) {
  return tiers
    .map((tier, index) => ({
      id: tier.id || `tier-${index + 1}`,
      minSales: safeNum(tier.minSales),
      rate: safeNum(tier.rate),
    }))
    .filter((tier) => tier.minSales >= 0 && tier.rate >= 0)
    .sort((a, b) => a.minSales - b.minSales);
}

function getCurrentTier(tiers: CommissionTier[], achievedProfit: number) {
  const normalized = normalizeTiers(tiers);
  return (
    normalized
      .filter((tier) => achievedProfit >= tier.minSales)
      .sort((a, b) => b.minSales - a.minSales)[0] || null
  );
}

function getNextTier(tiers: CommissionTier[], achievedProfit: number) {
  return normalizeTiers(tiers).find((tier) => tier.minSales > achievedProfit) || null;
}

export default function ManagementTargetsPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Record<string, CommissionPlan>>({});
  const [selectedMonth, setSelectedMonth] = useState(() => monthValue(new Date()));
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState("");
  const [draftTiers, setDraftTiers] = useState<CommissionTier[]>(defaultTiers);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    const loadData = async () => {
      try {
        setLoading(true);
        const [ordersSnap, usersSnap, plansSnap] = await Promise.all([
          getDocs(collection(db, "salesOrders")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "salesCommissionPlans")),
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

        const nextPlans: Record<string, CommissionPlan> = {};
        plansSnap.docs.forEach((planDoc) => {
          const data = planDoc.data() as Omit<CommissionPlan, "id">;
          nextPlans[planDoc.id] = {
            id: planDoc.id,
            ...data,
            targetAmount: safeNum(data.targetAmount),
            currency: data.currency || "SAR",
            tiers: normalizeTiers(data.tiers || defaultTiers),
          };
        });
        setPlans(nextPlans);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load targets and commissions");
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

  const employeeRows = useMemo(() => {
    const orderCreatorIds = new Set(
      orders.map((order) => order.createdBy).filter(Boolean) as string[]
    );
    const employeeIds = new Set<string>();

    users.forEach((user) => {
      if (isSalesUser(user, orderCreatorIds.has(user.id))) {
        employeeIds.add(user.id);
      }
    });
    orderCreatorIds.forEach((id) => employeeIds.add(id));

    return Array.from(employeeIds)
      .map((employeeId) => {
        const user = users.find((item) => item.id === employeeId);
        const employeeOrders = monthOrders.filter(
          (order) => order.createdBy === employeeId
        );
        const achievedSales = employeeOrders.reduce(
          (sum, order) => sum + getOrderAmount(order),
          0
        );
        const paidAmount = employeeOrders.reduce(
          (sum, order) => sum + safeNum(order.paidAmount),
          0
        );
        const profitAmount = employeeOrders.reduce(
          (sum, order) => sum + safeNum(order.totalProfit),
          0
        );
        const commissionBase = profitAmount * 0.85;
        const employeePlan = plans[planId(employeeId, selectedMonth)];
        const currency = "SAR";
        const targetAmount = safeNum(employeePlan?.targetAmount);
        const tiers = employeePlan?.tiers?.length ? employeePlan.tiers : defaultTiers;
        const currentTier = getCurrentTier(tiers, profitAmount);
        const nextTier = getNextTier(tiers, profitAmount);
        const commissionAmount = currentTier
          ? (commissionBase * safeNum(currentTier.rate)) / 100
          : 0;
        const progress = targetAmount
          ? Math.min(100, Math.round((commissionBase / targetAmount) * 100))
          : 0;

        return {
          id: employeeId,
          name: user?.name || user?.email || employeeId,
          email: user?.email,
          achievedSales,
          paidAmount,
          profitAmount,
          commissionBase,
          orderCount: employeeOrders.length,
          currency,
          targetAmount,
          tiers,
          currentTier,
          nextTier,
          commissionAmount,
          progress,
          hasPlan: Boolean(employeePlan),
        };
      })
      .sort((a, b) => b.achievedSales - a.achievedSales || b.orderCount - a.orderCount);
  }, [monthOrders, orders, plans, selectedMonth, users]);

  const overview = useMemo(() => {
    const totalTarget = employeeRows.reduce((sum, row) => sum + row.targetAmount, 0);
    const totalSales = employeeRows.reduce((sum, row) => sum + row.achievedSales, 0);
    const totalProfitAfterVat = employeeRows.reduce(
      (sum, row) => sum + row.commissionBase,
      0
    );
    const totalCommission = employeeRows.reduce(
      (sum, row) => sum + row.commissionAmount,
      0
    );
    const configured = employeeRows.filter((row) => row.hasPlan).length;

    return {
      totalTarget,
      totalSales,
      totalProfitAfterVat,
      totalCommission,
      configured,
      employees: employeeRows.length,
    };
  }, [employeeRows]);

  const openEditor = (employeeId: string) => {
    const row = employeeRows.find((employee) => employee.id === employeeId);
    const existingPlan = plans[planId(employeeId, selectedMonth)];

    setEditingEmployeeId(employeeId);
    setDraftTarget(String(existingPlan?.targetAmount || row?.targetAmount || ""));
    setDraftTiers(
      normalizeTiers(existingPlan?.tiers?.length ? existingPlan.tiers : defaultTiers)
    );
  };

  const updateTier = (
    tierId: string,
    field: keyof Pick<CommissionTier, "minSales" | "rate">,
    value: string
  ) => {
    setDraftTiers((prev) =>
      prev.map((tier) =>
        tier.id === tierId
          ? {
              ...tier,
              [field]: safeNum(value),
            }
          : tier
      )
    );
  };

  const addTier = () => {
    setDraftTiers((prev) => [
      ...prev,
      {
        id: `tier-${Date.now()}`,
        minSales: 0,
        rate: 0,
      },
    ]);
  };

  const removeTier = (tierId: string) => {
    setDraftTiers((prev) => prev.filter((tier) => tier.id !== tierId));
  };

  const savePlan = async () => {
    if (!editingEmployeeId) return;

    const targetAmount = safeNum(draftTarget);
    const tiers = normalizeTiers(draftTiers);

    if (targetAmount < 0) {
      toast.error("Target amount must be zero or greater.");
      return;
    }
    if (tiers.length === 0) {
      toast.error("Add at least one commission tier.");
      return;
    }

    try {
      setSaving(true);
      const id = planId(editingEmployeeId, selectedMonth);
      const payload = {
        employeeId: editingEmployeeId,
        month: selectedMonth,
        targetAmount,
        currency: "SAR",
        tiers,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || null,
      };

      await setDoc(doc(db, "salesCommissionPlans", id), payload, { merge: true });

      setPlans((prev) => ({
        ...prev,
        [id]: {
          id,
          ...payload,
          updatedAt: new Date(),
        } as CommissionPlan,
      }));
      setEditingEmployeeId(null);
      toast.success("Target and commission plan saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save target and commission plan");
    } finally {
      setSaving(false);
    }
  };

  const editingEmployee = employeeRows.find(
    (employee) => employee.id === editingEmployeeId
  );

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
                    <BreadcrumbPage>Targets & Commissions</BreadcrumbPage>
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
                    <Target className="h-4 w-4" />
                    <span>Management</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                    Targets & Commissions
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
                <MetricCard
                  title="Employees"
                  value={String(overview.employees)}
                  detail={`${overview.configured} configured`}
                  icon={<Users className="h-5 w-5" />}
                  tone="bg-sky-50 text-sky-700 dark:bg-sky-950/40"
                />
                <MetricCard
                  title="Total Target"
                  value={formatCurrency(overview.totalTarget)}
                  detail={monthLabel(selectedMonth)}
                  icon={<Goal className="h-5 w-5" />}
                  tone="bg-violet-50 text-violet-700 dark:bg-violet-950/40"
                />
                <MetricCard
                  title="Sales"
                  value={formatCurrency(overview.totalSales)}
                  detail="Actual monthly sales"
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                />
                <MetricCard
                  title="Commission"
                  value={formatCurrency(overview.totalCommission)}
                  detail="Estimated payout"
                  icon={<BadgeDollarSign className="h-5 w-5" />}
                  tone="bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                />
                <MetricCard
                  title="Achievement"
                  value={`${
                    overview.totalTarget
                      ? Math.round(
                          (overview.totalProfitAfterVat / overview.totalTarget) * 100
                        )
                      : 0
                  }%`}
                  detail="Profit after VAT progress"
                  icon={<TrendingUp className="h-5 w-5" />}
                  tone="bg-teal-50 text-teal-700 dark:bg-teal-950/40"
                />
              </div>

              {loading ? (
                <Card className="border bg-background shadow-sm">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Loading targets...
                  </CardContent>
                </Card>
              ) : employeeRows.length === 0 ? (
                <Card className="border bg-background shadow-sm">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No sales employees found.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {employeeRows.map((employee) => (
                    <Card
                      key={employee.id}
                      className="overflow-hidden border bg-background shadow-sm"
                    >
                      <CardHeader className="border-b bg-muted/20 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">
                              {employee.name}
                            </CardTitle>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {employee.email || employee.id}
                            </div>
                          </div>
                          <Badge variant={employee.hasPlan ? "default" : "secondary"}>
                            {employee.hasPlan ? "Configured" : "Default"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <InfoTile
                            label="Target"
                            value={formatCurrency(employee.targetAmount, employee.currency)}
                          />
                          <InfoTile
                            label="Sales"
                            value={formatCurrency(employee.achievedSales, employee.currency)}
                            tone="text-emerald-700"
                          />
                          <InfoTile label="Orders" value={String(employee.orderCount)} />
                          <InfoTile
                            label="Commission"
                            value={formatCurrency(employee.commissionAmount, employee.currency)}
                            tone="text-amber-700"
                          />
                          <InfoTile
                            label="Profit"
                            value={formatCurrency(employee.profitAmount, employee.currency)}
                            tone="text-sky-700"
                          />
                          <InfoTile
                            label="Profit After VAT"
                            value={formatCurrency(employee.commissionBase, employee.currency)}
                            tone="text-violet-700"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Profit After VAT Progress
                            </span>
                            <span className="font-medium">{employee.progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${employee.progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="rounded-md border bg-muted/10 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Current Tier
                              </div>
                              <div className="mt-1 text-sm font-semibold">
                                {employee.currentTier
                                  ? `${employee.currentTier.rate}% from ${formatCurrency(
                                      employee.currentTier.minSales,
                                      employee.currency
                                    )} profit`
                                  : "Not reached yet"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">
                                Next Tier
                              </div>
                              <div className="mt-1 text-sm font-semibold">
                                {employee.nextTier
                                  ? `${formatCurrency(
                                      employee.nextTier.minSales,
                                      employee.currency
                                    )} profit / ${employee.nextTier.rate}%`
                                  : "Top tier"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          <div className="text-xs opacity-80">
                            Commission Calculation
                          </div>
                          <div className="mt-1 font-semibold">
                            {employee.currentTier
                              ? `${formatCurrency(
                                  employee.commissionBase,
                                  employee.currency
                                )} x ${employee.currentTier.rate}% = ${formatCurrency(
                                  employee.commissionAmount,
                                  employee.currency
                                )}`
                              : employee.nextTier
                                ? `No commission until profit reaches ${formatCurrency(
                                    employee.nextTier.minSales,
                                    employee.currency
                                  )}.`
                                : "No commission tier available."}
                          </div>
                        </div>

                        <Button className="w-full" onClick={() => openEditor(employee.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Target & Tiers
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={Boolean(editingEmployeeId)} onOpenChange={() => setEditingEmployeeId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Target & Commission Plan</DialogTitle>
            <DialogDescription>
              {editingEmployee?.name || "Employee"} - {monthLabel(selectedMonth)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor="target-amount">Monthly Target</Label>
                <Input
                  id="target-amount"
                  type="number"
                  min="0"
                  value={draftTarget}
                  onChange={(event) => setDraftTarget(event.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                <div>
                  <div className="font-semibold">Commission Tiers</div>
                  <div className="text-xs text-muted-foreground">
                    Highest matching tier applies to total monthly profit.
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tier
                </Button>
              </div>

              <div className="space-y-3 p-4">
                {normalizeTiers(draftTiers).map((tier, index) => (
                  <div
                    key={tier.id}
                    className="grid grid-cols-1 gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`${tier.id}-min`}>Minimum Profit</Label>
                      <Input
                        id={`${tier.id}-min`}
                        type="number"
                        min="0"
                        value={tier.minSales}
                        onChange={(event) =>
                          updateTier(tier.id, "minSales", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${tier.id}-rate`}>Commission %</Label>
                      <Input
                        id={`${tier.id}-rate`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.rate}
                        onChange={(event) =>
                          updateTier(tier.id, "rate", event.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2 md:justify-end">
                      <Badge variant="secondary">Tier {index + 1}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeTier(tier.id)}
                        disabled={draftTiers.length <= 1}
                        title="Remove tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingEmployeeId(null)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={savePlan} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRouteWithPrivilege>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
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
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function InfoTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/10 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold ${tone || ""}`}>
        {value}
      </div>
    </div>
  );
}
