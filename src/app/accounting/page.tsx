"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Filter,
  Paperclip,
  ReceiptText,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { useAuth } from "@/context/AuthContext";
import { usePrivilege } from "@/hooks/usePrivilege";

type AccountingEntry = {
  id: string;
  orderId: string;
  orderNumber?: string;
  customerId: string;
  direction: "in" | "out";
  sourceType: "customer_payment" | "service_cost" | "payment_method_fee";
  amount: number;
  currency: "SAR";
  paymentMethodId?: string;
  paymentMethodName?: string;
  paymentMethodPercentageRate?: number;
  paymentMethodFixedFee?: number;
  paymentMethodFeeAmount?: number;
  description: string;
  file?: {
    name: string;
    url: string;
    path: string;
  } | null;
  status: "pending" | "confirmed";
  createdBy?: string | null;
  createdAt?: any;
  confirmedBy?: string | null;
  confirmedAt?: any;
};

type UserMap = Record<string, { name?: string; email?: string }>;
type CustomerMap = Record<string, { name?: string; phone?: string }>;
type OrderMap = Record<
  string,
  {
    orderNumber?: string;
    customerId?: string;
    createdBy?: string | null;
    status?: string;
    totalCost?: number;
    totalPrice?: number;
    totalProfit?: number;
    fullAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    createdAt?: any;
  }
>;
type UploadedFile = {
  name?: string;
  url?: string;
  path?: string;
} | null;

type OrderSummary = {
  id: string;
  orderNumber?: string;
  status?: string;
  totalCost?: number;
  totalPrice?: number;
  totalProfit?: number;
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
};

type OrderService = {
  id: string;
  type?: string;
  description?: string;
  cost?: number;
  invoiceFile?: UploadedFile;
};

type OrderPayment = {
  id: string;
  amount?: number;
  paymentMethodName?: string;
  paymentMethodFeeAmount?: number;
  receiptFile?: UploadedFile;
  createdAt?: any;
};

type OrderDetails = {
  order: OrderSummary;
  services: OrderService[];
  payments: OrderPayment[];
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

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function entryDateValue(value: any) {
  const date = toDate(value);
  return date ? dateInputValue(date) : "";
}

function todayRange() {
  const today = new Date();
  const value = dateInputValue(today);
  return { from: value, to: value };
}

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function previousMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function displayDate(value: any) {
  const date = toDate(value);
  return date ? format(date, "MMM d, yyyy HH:mm") : "-";
}

function formatMoney(value: number) {
  return `${safeNum(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} SAR`;
}

function sourceLabel(sourceType: AccountingEntry["sourceType"]) {
  const labels: Record<AccountingEntry["sourceType"], string> = {
    customer_payment: "Customer Payment",
    service_cost: "Service Cost",
    payment_method_fee: "Payment Fee",
  };

  return labels[sourceType] || sourceType.split("_").join(" ");
}

function hasAttachment(file: UploadedFile) {
  return Boolean(file?.url);
}

export default function AccountingPage() {
  const { user, loading: authLoading, privileges } = useAuth();
  const canView = privileges?.["accounting.view"] ?? false;
  const canConfirm = usePrivilege("accounting.confirm");

  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [customers, setCustomers] = useState<CustomerMap>({});
  const [orders, setOrders] = useState<OrderMap>({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(() => todayRange().from);
  const [dateTo, setDateTo] = useState(() => todayRange().to);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;
      if (!user || !canView) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [entriesSnap, usersSnap, customersSnap, ordersSnap] = await Promise.all([
          getDocs(collection(db, "accountingEntries")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "salesOrders")),
        ]);

        const nextEntries = entriesSnap.docs
          .map((entryDoc) => ({
            id: entryDoc.id,
            ...(entryDoc.data() as Omit<AccountingEntry, "id">),
          }))
          .sort((a, b) => {
            const aDate = toDate(a.createdAt)?.getTime() ?? 0;
            const bDate = toDate(b.createdAt)?.getTime() ?? 0;
            return bDate - aDate;
          });

        const backfilledEntries: AccountingEntry[] = [];
        const existingCustomerPaymentOrders = new Set(
          nextEntries
            .filter((entry) => entry.sourceType === "customer_payment")
            .map((entry) => entry.orderId)
        );

        for (const orderDoc of ordersSnap.docs) {
          const orderData = orderDoc.data() as any;
          const paidAmount = safeNum(orderData.paidAmount);

          if (paidAmount <= 0 || existingCustomerPaymentOrders.has(orderDoc.id)) {
            continue;
          }

          const entryId = `missing_customer_payment_${orderDoc.id}`;
          const repairedEntry: AccountingEntry = {
            id: entryId,
            orderId: orderDoc.id,
            orderNumber: orderData.orderNumber,
            customerId: orderData.customerId,
            direction: "in",
            sourceType: "customer_payment",
            amount: paidAmount,
            currency: "SAR",
            description: "Customer payment from order paid amount",
            file: null,
            status: "pending",
            createdBy: orderData.createdBy || null,
            createdAt: orderData.createdAt || new Date(),
            confirmedBy: null,
            confirmedAt: null,
          };

          await setDoc(
            doc(db, "accountingEntries", entryId),
            {
              orderId: repairedEntry.orderId,
              customerId: repairedEntry.customerId,
              direction: repairedEntry.direction,
              sourceType: repairedEntry.sourceType,
              amount: repairedEntry.amount,
              currency: repairedEntry.currency,
              orderNumber: orderData.orderNumber || null,
              description: repairedEntry.description,
              file: null,
              status: "pending",
              createdBy: repairedEntry.createdBy,
              createdAt: orderData.createdAt || serverTimestamp(),
              confirmedBy: null,
              confirmedAt: null,
              repairedFromOrderPaidAmount: true,
            },
            { merge: false }
          );

          existingCustomerPaymentOrders.add(orderDoc.id);
          backfilledEntries.push(repairedEntry);
        }

        const nextUsers: UserMap = {};
        usersSnap.docs.forEach((userDoc) => {
          const data = userDoc.data() as any;
          nextUsers[userDoc.id] = {
            name: data.name,
            email: data.email,
          };
        });

        const nextCustomers: CustomerMap = {};
        customersSnap.docs.forEach((customerDoc) => {
          const data = customerDoc.data() as any;
          nextCustomers[customerDoc.id] = {
            name: data.name,
            phone: data.phone,
          };
        });

        const nextOrders: OrderMap = {};
        ordersSnap.docs.forEach((orderDoc) => {
          const data = orderDoc.data() as any;
          nextOrders[orderDoc.id] = {
            orderNumber: data.orderNumber,
            customerId: data.customerId,
            createdBy: data.createdBy || null,
            status: data.status,
            totalCost: data.totalCost,
            totalPrice: data.totalPrice,
            totalProfit: data.totalProfit,
            fullAmount: data.fullAmount,
            paidAmount: data.paidAmount,
            remainingAmount: data.remainingAmount,
            createdAt: data.createdAt,
          };
        });

        setEntries(
          [...backfilledEntries, ...nextEntries].sort((a, b) => {
            const aDate = toDate(a.createdAt)?.getTime() ?? 0;
            const bDate = toDate(b.createdAt)?.getTime() ?? 0;
            return bDate - aDate;
          })
        );
        setUsers(nextUsers);
        setCustomers(nextCustomers);
        setOrders(nextOrders);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load accounting entries");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, canView, user]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (directionFilter !== "all" && entry.direction !== directionFilter) {
        return false;
      }
      const entryDate = entryDateValue(entry.createdAt);
      if (dateFrom && (!entryDate || entryDate < dateFrom)) return false;
      if (dateTo && (!entryDate || entryDate > dateTo)) return false;
      if (employeeFilter !== "all" && entry.createdBy !== employeeFilter) {
        return false;
      }
      return true;
    });
  }, [entries, statusFilter, directionFilter, dateFrom, dateTo, employeeFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        const bucket = entry.status === "confirmed" ? "confirmed" : "pending";
        const direction = entry.direction === "in" ? "in" : "out";
        acc[bucket][direction] += safeNum(entry.amount);
        return acc;
      },
      {
        pending: { in: 0, out: 0 },
        confirmed: { in: 0, out: 0 },
      }
    );
  }, [filteredEntries]);

  const employeeOptions = useMemo(() => {
    const ids = Array.from(
      new Set(entries.map((entry) => entry.createdBy).filter(Boolean))
    ) as string[];
    return ids.sort((a, b) => {
      const an = users[a]?.name || users[a]?.email || a;
      const bn = users[b]?.name || users[b]?.email || b;
      return an.localeCompare(bn);
    });
  }, [entries, users]);

  const overview = useMemo(() => {
    const totalIn = totals.pending.in + totals.confirmed.in;
    const totalOut = totals.pending.out + totals.confirmed.out;
    const pendingCount = filteredEntries.filter(
      (entry) => entry.status === "pending"
    ).length;
    const confirmedCount = filteredEntries.filter(
      (entry) => entry.status === "confirmed"
    ).length;

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      pendingCount,
      confirmedCount,
    };
  }, [filteredEntries, totals]);

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);

    if (preset === "today") {
      const range = todayRange();
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }

    if (preset === "thisMonth") {
      const range = thisMonthRange();
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }

    if (preset === "previousMonth") {
      const range = previousMonthRange();
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const presetButtonClass = (preset: string) =>
    `h-8 rounded-md border px-3 text-xs font-medium transition-colors ${
      datePreset === preset
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background hover:bg-muted"
    }`;

  const confirmEntry = async (entryId: string) => {
    if (!canConfirm) {
      toast.error("You do not have permission to confirm entries.");
      return;
    }

    try {
      setConfirmingId(entryId);
      await updateDoc(doc(db, "accountingEntries", entryId), {
        status: "confirmed",
        confirmedBy: user?.uid || null,
        confirmedAt: serverTimestamp(),
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "confirmed",
                confirmedBy: user?.uid || null,
                confirmedAt: new Date(),
              }
            : entry
        )
      );
      toast.success("Entry confirmed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm entry");
    } finally {
      setConfirmingId(null);
    }
  };

  const unconfirmEntry = async (entryId: string) => {
    if (!canConfirm) {
      toast.error("You do not have permission to update confirmations.");
      return;
    }

    try {
      setConfirmingId(entryId);
      await updateDoc(doc(db, "accountingEntries", entryId), {
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "pending",
                confirmedBy: null,
                confirmedAt: null,
              }
            : entry
        )
      );
      toast.success("Confirmation removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove confirmation");
    } finally {
      setConfirmingId(null);
    }
  };

  const openOrderDetails = async (orderId: string) => {
    if (!orderId) return;

    try {
      setOrderDialogOpen(true);
      setLoadingOrderDetails(true);
      setOrderDetails(null);

      const [orderSnap, servicesSnap, paymentsSnap] = await Promise.all([
        getDoc(doc(db, "salesOrders", orderId)),
        getDocs(collection(db, "salesOrders", orderId, "services")),
        getDocs(collection(db, "salesOrders", orderId, "payments")),
      ]);

      if (!orderSnap.exists()) {
        toast.error("Order not found");
        setOrderDialogOpen(false);
        return;
      }

      const orderData = orderSnap.data() as any;
      const services = servicesSnap.docs.map((serviceDoc) => ({
        id: serviceDoc.id,
        ...(serviceDoc.data() as any),
      })) as OrderService[];
      const payments = paymentsSnap.docs.map((paymentDoc) => ({
        id: paymentDoc.id,
        ...(paymentDoc.data() as any),
      })) as OrderPayment[];

      setOrderDetails({
        order: {
          id: orderSnap.id,
          orderNumber: orderData.orderNumber,
          status: orderData.status,
          totalCost: orderData.totalCost,
          totalPrice: orderData.totalPrice,
          totalProfit: orderData.totalProfit,
          fullAmount: orderData.fullAmount,
          paidAmount: orderData.paidAmount,
          remainingAmount: orderData.remainingAmount,
        },
        services,
        payments,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load order details");
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const metricCard = (
    title: string,
    value: string,
    detail: string,
    icon: ReactNode,
    tone: string
  ) => (
    <Card className="border bg-background shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 truncate text-xl font-semibold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  );

  const attachmentCell = (file: UploadedFile, label: string) => {
    if (hasAttachment(file)) {
      return (
        <Button asChild variant="outline" size="sm">
          <a href={file?.url} target="_blank" rel="noreferrer">
            <Paperclip className="mr-1 h-4 w-4" />
            {label}
          </a>
        </Button>
      );
    }

    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        <FileWarning className="h-3.5 w-3.5" />
        Missing Attachment
      </div>
    );
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="accounting.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Accounting</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="min-h-screen bg-muted/10">
            <div className="space-y-5 p-4 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ReceiptText className="h-4 w-4" />
                    <span>Accounting Entries</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                    In / Out Review
                  </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{filteredEntries.length} entries</Badge>
                  <Badge variant="outline">{overview.pendingCount} pending</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                {metricCard(
                  "Net Balance",
                  formatMoney(overview.net),
                  "In minus out",
                  <Banknote className="h-5 w-5" />,
                  overview.net >= 0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                )}
                {metricCard(
                  "Total In",
                  formatMoney(overview.totalIn),
                  `${formatMoney(totals.pending.in)} pending`,
                  <TrendingUp className="h-5 w-5" />,
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                )}
                {metricCard(
                  "Total Out",
                  formatMoney(overview.totalOut),
                  `${formatMoney(totals.pending.out)} pending`,
                  <TrendingDown className="h-5 w-5" />,
                  "bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                )}
                {metricCard(
                  "Pending",
                  String(overview.pendingCount),
                  formatMoney(totals.pending.in - totals.pending.out),
                  <Clock3 className="h-5 w-5" />,
                  "bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                )}
                {metricCard(
                  "Confirmed",
                  String(overview.confirmedCount),
                  formatMoney(totals.confirmed.in - totals.confirmed.out),
                  <CheckCircle2 className="h-5 w-5" />,
                  "bg-sky-50 text-sky-700 dark:bg-sky-950/40"
                )}
              </div>

              <Card className="border bg-background shadow-sm">
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex h-8 items-center gap-2 rounded-md border bg-muted/20 px-2 text-xs font-medium text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      Filters
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={presetButtonClass("today")}
                        onClick={() => applyDatePreset("today")}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className={presetButtonClass("thisMonth")}
                        onClick={() => applyDatePreset("thisMonth")}
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        className={presetButtonClass("previousMonth")}
                        onClick={() => applyDatePreset("previousMonth")}
                      >
                        Previous Month
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={dateFrom}
                        onChange={(event) => {
                          setDatePreset("custom");
                          setDateFrom(event.target.value);
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={dateTo}
                        onChange={(event) => {
                          setDatePreset("custom");
                          setDateTo(event.target.value);
                        }}
                      />
                    </div>

                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                    </select>

                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={directionFilter}
                      onChange={(event) => setDirectionFilter(event.target.value)}
                    >
                      <option value="all">All Directions</option>
                      <option value="in">In</option>
                      <option value="out">Out</option>
                    </select>

                    <select
                      className="h-8 min-w-[150px] rounded-md border bg-background px-2 text-xs"
                      value={employeeFilter}
                      onChange={(event) => setEmployeeFilter(event.target.value)}
                    >
                      <option value="all">All Employees</option>
                      {employeeOptions.map((employeeId) => (
                        <option key={employeeId} value={employeeId}>
                          {users[employeeId]?.name ||
                            users[employeeId]?.email ||
                            employeeId}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border bg-background shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Entries</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {formatMoney(overview.totalIn)} in /{" "}
                      {formatMoney(overview.totalOut)} out
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading accounting entries...
                    </div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No entries found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1120px] text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Entry</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Employee</th>
                            <th className="px-4 py-3 font-medium">Method</th>
                            <th className="px-4 py-3 font-medium">Fee</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Amount
                            </th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                            <th className="px-4 py-3 font-medium">File</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntries.map((entry) => {
                            const customer = customers[entry.customerId];
                            const employee = entry.createdBy
                              ? users[entry.createdBy]
                              : null;
                            const isIn = entry.direction === "in";

                            return (
                              <tr
                                key={entry.id}
                                className="border-b transition-colors hover:bg-muted/20 last:border-0"
                              >
                                <td className="px-4 py-4 align-top">
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-md ${
                                        isIn
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                                      }`}
                                    >
                                      {isIn ? (
                                        <ArrowDownLeft className="h-4 w-4" />
                                      ) : (
                                        <ArrowUpRight className="h-4 w-4" />
                                      )}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="truncate font-medium">
                                        {entry.description || "-"}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>{sourceLabel(entry.sourceType)}</span>
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                        <button
                                          type="button"
                                          className="max-w-[150px] truncate text-primary underline-offset-2 hover:underline"
                                          onClick={() =>
                                            openOrderDetails(entry.orderId)
                                          }
                                          title="Open order details"
                                        >
                                          {entry.orderNumber ||
                                            orders[entry.orderId]?.orderNumber ||
                                            entry.orderId}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="font-medium">
                                    {customer?.name || "-"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {customer?.phone || entry.customerId}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div>{employee?.name || employee?.email || "-"}</div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {entry.paymentMethodName ? (
                                    <div>
                                      <div>{entry.paymentMethodName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {safeNum(entry.paymentMethodPercentageRate)}% +{" "}
                                        {safeNum(entry.paymentMethodFixedFee)} SAR
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {typeof entry.paymentMethodFeeAmount === "number" ? (
                                    formatMoney(entry.paymentMethodFeeAmount)
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right align-top">
                                  <span
                                    className={`font-semibold ${
                                      isIn ? "text-emerald-600" : "text-rose-600"
                                    }`}
                                  >
                                    {isIn ? "+" : "-"}
                                    {formatMoney(entry.amount)}
                                  </span>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <Badge
                                    variant={
                                      entry.status === "confirmed"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {entry.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-4 align-top text-muted-foreground">
                                  {displayDate(entry.createdAt)}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {entry.file?.url ? (
                                    <Button asChild variant="outline" size="sm">
                                      <a
                                        href={entry.file.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <ExternalLink className="mr-1 h-4 w-4" />
                                        Open
                                      </a>
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right align-top">
                                  {entry.status === "pending" ? (
                                    <Button
                                      size="sm"
                                      className="cursor-pointer"
                                      onClick={() => confirmEntry(entry.id)}
                                      disabled={
                                        !canConfirm || confirmingId === entry.id
                                      }
                                    >
                                      <CheckCircle2 className="mr-1 h-4 w-4" />
                                      {confirmingId === entry.id
                                        ? "Confirming..."
                                        : "Confirm"}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="cursor-pointer"
                                      onClick={() => unconfirmEntry(entry.id)}
                                      disabled={
                                        !canConfirm || confirmingId === entry.id
                                      }
                                    >
                                      <RotateCcw className="mr-1 h-4 w-4" />
                                      {confirmingId === entry.id
                                        ? "Updating..."
                                        : "Undo Confirm"}
                                    </Button>
                                  )}
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

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Services, payments, and attachment status for the selected order.
            </DialogDescription>
          </DialogHeader>

          {loadingOrderDetails ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading order details...
            </div>
          ) : orderDetails ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Order</div>
                  <div className="mt-1 truncate text-sm font-semibold">
                    {orderDetails.order.orderNumber || orderDetails.order.id}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1 text-sm font-semibold capitalize">
                    {orderDetails.order.status || "-"}
                  </div>
                </div>
                <div className="rounded-md border bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <div className="text-xs opacity-80">Paid Amount</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatMoney(orderDetails.order.paidAmount || 0)}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <div className="text-xs opacity-80">Remaining</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatMoney(orderDetails.order.remainingAmount || 0)}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Full Amount</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatMoney(
                      orderDetails.order.fullAmount ||
                        orderDetails.order.totalPrice ||
                        0
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b bg-muted/20 px-4 py-3">
                  <div className="font-semibold">Services</div>
                </div>
                {orderDetails.services.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No services found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Service</th>
                          <th className="px-4 py-3 text-left font-medium">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right font-medium">Cost</th>
                          <th className="px-4 py-3 text-left font-medium">
                            Invoice
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.services.map((service) => (
                          <tr key={service.id} className="border-t">
                            <td className="px-4 py-3 font-medium">
                              {service.type || "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {service.description || "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatMoney(service.cost || 0)}
                            </td>
                            <td className="px-4 py-3">
                              {attachmentCell(service.invoiceFile || null, "Invoice")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border">
                <div className="border-b bg-muted/20 px-4 py-3">
                  <div className="font-semibold">Customer Payments</div>
                </div>
                {orderDetails.payments.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No customer payments found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                          <th className="px-4 py-3 text-left font-medium">Method</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                          <th className="px-4 py-3 text-right font-medium">Fee</th>
                          <th className="px-4 py-3 text-left font-medium">Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.payments.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="px-4 py-3 text-muted-foreground">
                              {displayDate(payment.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              {payment.paymentMethodName || "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {formatMoney(payment.amount || 0)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatMoney(payment.paymentMethodFeeAmount || 0)}
                            </td>
                            <td className="px-4 py-3">
                              {attachmentCell(payment.receiptFile || null, "Receipt")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Select an order to view details.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ProtectedRouteWithPrivilege>
  );
}
