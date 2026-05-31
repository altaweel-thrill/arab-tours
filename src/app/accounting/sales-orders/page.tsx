"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileWarning,
  Paperclip,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { usePrivilege } from "@/hooks/usePrivilege";

type UploadedFile = {
  name?: string;
  url?: string;
  path?: string;
} | null;

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
  file?: UploadedFile;
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
  order: OrderMap[string] & { id: string };
  accountingEntries: AccountingEntry[];
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

function compactStatusLabel(status?: string) {
  if (!status) return "-";
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasAttachment(file: UploadedFile) {
  return Boolean(file?.url);
}

export default function AccountingSalesOrdersPage() {
  const { user, loading: authLoading, privileges } = useAuth();
  const canView = privileges?.["accounting.view"] ?? false;
  const canConfirm = usePrivilege("accounting.confirm");

  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [customers, setCustomers] = useState<CustomerMap>({});
  const [orders, setOrders] = useState<OrderMap>({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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
        const [entriesSnap, usersSnap, customersSnap, ordersSnap] =
          await Promise.all([
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
        toast.error("Failed to load sales orders");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, canView, user]);

  const salesOrderRows = useMemo(() => {
    return Object.entries(orders)
      .map(([orderId, order]) => {
        const orderEntries = entries.filter((entry) => entry.orderId === orderId);
        const pendingEntries = orderEntries.filter(
          (entry) => entry.status !== "confirmed"
        );
        const confirmedEntries = orderEntries.filter(
          (entry) => entry.status === "confirmed"
        );
        const inAmount = orderEntries
          .filter((entry) => entry.direction === "in")
          .reduce((sum, entry) => sum + safeNum(entry.amount), 0);
        const outAmount = orderEntries
          .filter((entry) => entry.direction === "out")
          .reduce((sum, entry) => sum + safeNum(entry.amount), 0);
        const customerId = order.customerId || orderEntries[0]?.customerId;
        const marketerId =
          order.createdBy ||
          orderEntries.find((entry) => entry.createdBy)?.createdBy ||
          null;
        const accountingStatus =
          orderEntries.length === 0
            ? "Needs Review"
            : pendingEntries.length > 0
              ? "Needs Confirmation"
              : "Confirmed";

        return {
          id: orderId,
          ...order,
          customerId,
          marketerId,
          inAmount,
          outAmount,
          entryCount: orderEntries.length,
          pendingCount: pendingEntries.length,
          confirmedCount: confirmedEntries.length,
          needsConfirmation: pendingEntries.length > 0,
          accountingStatus,
        };
      })
      .sort((a, b) => {
        const aDate = toDate(a.createdAt)?.getTime() ?? 0;
        const bDate = toDate(b.createdAt)?.getTime() ?? 0;
        return bDate - aDate;
      });
  }, [entries, orders]);

  const overview = useMemo(() => {
    const needsConfirmation = salesOrderRows.filter(
      (order) => order.needsConfirmation
    ).length;
    const confirmed = salesOrderRows.filter(
      (order) => order.entryCount > 0 && order.pendingCount === 0
    ).length;
    const needsReview = salesOrderRows.filter(
      (order) => order.entryCount === 0
    ).length;

    return {
      total: salesOrderRows.length,
      needsConfirmation,
      confirmed,
      needsReview,
    };
  }, [salesOrderRows]);

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

      const updateEntry = (entry: AccountingEntry): AccountingEntry =>
        entry.id === entryId
          ? {
              ...entry,
              status: "confirmed",
              confirmedBy: user?.uid || null,
              confirmedAt: new Date(),
            }
          : entry;

      setEntries((prev) => prev.map(updateEntry));
      setOrderDetails((prev) =>
        prev
          ? {
              ...prev,
              accountingEntries: prev.accountingEntries.map(updateEntry),
            }
          : prev
      );
      toast.success("Entry confirmed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm entry");
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
      const accountingEntries = entries.filter((entry) => entry.orderId === orderId);

      setOrderDetails({
        order: {
          id: orderSnap.id,
          orderNumber: orderData.orderNumber,
          customerId: orderData.customerId,
          createdBy: orderData.createdBy || null,
          status: orderData.status,
          totalCost: orderData.totalCost,
          totalPrice: orderData.totalPrice,
          totalProfit: orderData.totalProfit,
          fullAmount: orderData.fullAmount,
          paidAmount: orderData.paidAmount,
          remainingAmount: orderData.remainingAmount,
          createdAt: orderData.createdAt,
        },
        accountingEntries,
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
                    <ClipboardList className="h-4 w-4" />
                    <span>Accounting Sales</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                    Sales Orders
                  </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{overview.total} orders</Badge>
                  <Badge variant="outline">
                    {overview.needsConfirmation} need confirmation
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      All Orders
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{overview.total}</div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Need Confirmation
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-amber-600">
                      {overview.needsConfirmation}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Confirmed
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-emerald-600">
                      {overview.confirmed}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border bg-background shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Needs Review
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-rose-600">
                      {overview.needsReview}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border bg-background shadow-sm">
                <CardHeader className="border-b bg-muted/20 px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    Sales Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading sales orders...
                    </div>
                  ) : salesOrderRows.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No sales orders found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1040px] text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Marketer</th>
                            <th className="px-4 py-3 font-medium">Order Status</th>
                            <th className="px-4 py-3 font-medium">
                              Accounting Status
                            </th>
                            <th className="px-4 py-3 text-right font-medium">In</th>
                            <th className="px-4 py-3 text-right font-medium">Out</th>
                            <th className="px-4 py-3 font-medium">
                              Confirmation
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesOrderRows.map((order) => {
                            const customer = order.customerId
                              ? customers[order.customerId]
                              : null;
                            const marketer = order.marketerId
                              ? users[order.marketerId]
                              : null;
                            const accountingTone =
                              order.accountingStatus === "Confirmed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : order.accountingStatus === "Needs Confirmation"
                                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";

                            return (
                              <tr
                                key={order.id}
                                className="border-b transition-colors hover:bg-muted/20 last:border-0"
                              >
                                <td className="px-4 py-4 align-top">
                                  <button
                                    type="button"
                                    className="font-semibold text-primary underline-offset-2 hover:underline"
                                    onClick={() => openOrderDetails(order.id)}
                                  >
                                    {order.orderNumber || order.id}
                                  </button>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {displayDate(order.createdAt)}
                                  </div>
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
                                  <div className="font-medium">
                                    {marketer?.name || marketer?.email || "-"}
                                  </div>
                                  {order.marketerId ? (
                                    <div className="text-xs text-muted-foreground">
                                      {order.marketerId}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <Badge variant="outline">
                                    {compactStatusLabel(order.status)}
                                  </Badge>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <Badge variant="outline" className={accountingTone}>
                                    {order.accountingStatus}
                                  </Badge>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {order.entryCount} operations
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right align-top font-semibold text-emerald-600">
                                  {formatMoney(order.inAmount)}
                                </td>
                                <td className="px-4 py-4 text-right align-top font-semibold text-rose-600">
                                  {formatMoney(order.outAmount)}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {order.pendingCount > 0 ? (
                                    <div className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                                      <Clock3 className="h-3.5 w-3.5" />
                                      {order.pendingCount} pending
                                    </div>
                                  ) : order.entryCount === 0 ? (
                                    <div className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                                      <FileWarning className="h-3.5 w-3.5" />
                                      No entries
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      No confirmation needed
                                    </div>
                                  )}
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {order.confirmedCount} confirmed
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right align-top">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openOrderDetails(order.id)}
                                  >
                                    Review
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

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Accounting operations, services, payments, and attachment status.
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
                  <div className="mt-1 text-sm font-semibold">
                    {compactStatusLabel(orderDetails.order.status)}
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
                  <div className="font-semibold">Accounting Operations</div>
                </div>
                {orderDetails.accountingEntries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No accounting operations found for this order.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">
                            Operation
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            Direction
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-left font-medium">File</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.accountingEntries.map((entry) => {
                          const isIn = entry.direction === "in";

                          return (
                            <tr key={entry.id} className="border-t">
                              <td className="px-4 py-3">
                                <div className="font-medium">
                                  {entry.description || sourceLabel(entry.sourceType)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {sourceLabel(entry.sourceType)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                                    isIn
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  }`}
                                >
                                  {isIn ? (
                                    <ArrowDownLeft className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  )}
                                  {entry.direction.toUpperCase()}
                                </div>
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-semibold ${
                                  isIn ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {isIn ? "+" : "-"}
                                {formatMoney(entry.amount)}
                              </td>
                              <td className="px-4 py-3">
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
                              <td className="px-4 py-3">
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
                              <td className="px-4 py-3 text-right">
                                {entry.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    onClick={() => confirmEntry(entry.id)}
                                    disabled={!canConfirm || confirmingId === entry.id}
                                  >
                                    <CheckCircle2 className="mr-1 h-4 w-4" />
                                    {confirmingId === entry.id
                                      ? "Confirming..."
                                      : "Confirm"}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No confirmation needed
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
              Select an order to review.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ProtectedRouteWithPrivilege>
  );
}
