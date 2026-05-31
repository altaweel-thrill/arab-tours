"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

import {
  Eye,
  FileWarning,
  Paperclip,
  Save,
  Search,
  Upload,
} from "lucide-react";

/* ---------------- Types ---------------- */

type Order = {
  id: string;
  orderNumber?: string;
  customerId: string;
  status: string;
  totalCost?: number;
  totalPrice: number;
  totalProfit: number;
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

type Service = {
  id: string;
  type: string;
  description: string;
  qty?: number;
  unitCost?: number;
  cost?: number;
  price: number;
  profit: number;
  invoiceFile?: UploadedFile;
};

type UploadedFile = {
  name?: string;
  url?: string;
  path?: string;
} | null;

type Payment = {
  id: string;
  amount?: number;
  paymentMethodName?: string;
  paymentMethodFeeAmount?: number;
  receiptFile?: UploadedFile;
  note?: string;
  createdAt?: any;
};

type CustomerInfo = {
  name: string;
  phone: string;
};

type OrderDetails = {
  order: Order;
  customer?: CustomerInfo;
  services: Service[];
  payments: Payment[];
};

function displayOrderNumber(order: Pick<Order, "id" | "orderNumber">) {
  return order.orderNumber || order.id;
}

function safeNum(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: any) {
  return `${safeNum(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} SAR`;
}

function hasAttachment(file: UploadedFile) {
  return Boolean(file?.url);
}

/* ---------------- Page ---------------- */

export default function MySalesPage() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Record<string, CustomerInfo>>({});

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editFullAmount, setEditFullAmount] = useState(0);
  const [editPaidAmount, setEditPaidAmount] = useState(0);

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

  const loadOrderDetails = async (orderId: string) => {
    try {
      setDetailsOpen(true);
      setLoadingDetails(true);
      setOrderDetails(null);

      const [orderSnap, servicesSnap, paymentsSnap] = await Promise.all([
        getDoc(doc(db, "salesOrders", orderId)),
        getDocs(collection(db, "salesOrders", orderId, "services")),
        getDocs(collection(db, "salesOrders", orderId, "payments")),
      ]);

      if (!orderSnap.exists()) return;

      const order = { id: orderSnap.id, ...(orderSnap.data() as any) } as Order;
      const services = servicesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Service[];
      const payments = paymentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Payment[];

      const customer = customers[order.customerId];
      setOrderDetails({ order, customer, services, payments });
      setEditStatus(order.status || "pending");
      setEditFullAmount(safeNum(order.fullAmount ?? order.totalPrice));
      setEditPaidAmount(safeNum(order.paidAmount));
    } finally {
      setLoadingDetails(false);
    }
  };

  const syncAccountingAttachment = async (
    orderId: string,
    match: { serviceId?: string; paymentId?: string },
    file: UploadedFile
  ) => {
    const snap = await getDocs(
      query(collection(db, "accountingEntries"), where("orderId", "==", orderId))
    );

    await Promise.all(
      snap.docs
        .filter((entryDoc) => {
          const data = entryDoc.data() as any;
          if (match.serviceId) return data.serviceId === match.serviceId;
          if (match.paymentId) return data.paymentId === match.paymentId;
          return false;
        })
        .map((entryDoc) =>
          updateDoc(entryDoc.ref, {
            file,
            updatedAt: serverTimestamp(),
          })
        )
    );
  };

  const uploadOrderFile = async (
    kind: "service" | "payment",
    itemId: string,
    file: File
  ) => {
    if (!orderDetails) return;

    try {
      const key = `${kind}-${itemId}`;
      setUploadingKey(key);
      const orderId = orderDetails.order.id;
      const folder = kind === "service" ? "services" : "payments";
      const fieldName = kind === "service" ? "invoiceFile" : "receiptFile";
      const pathPart = kind === "service" ? "invoice" : "receipt";
      const filePath = `salesOrders/${orderId}/${folder}/${itemId}/${pathPart}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const uploadedFile = {
        name: file.name,
        url,
        path: filePath,
      };

      await updateDoc(doc(db, "salesOrders", orderId, folder, itemId), {
        [fieldName]: uploadedFile,
        updatedAt: serverTimestamp(),
      });

      await syncAccountingAttachment(
        orderId,
        kind === "service" ? { serviceId: itemId } : { paymentId: itemId },
        uploadedFile
      );

      setOrderDetails((prev) => {
        if (!prev) return prev;
        if (kind === "service") {
          return {
            ...prev,
            services: prev.services.map((service) =>
              service.id === itemId
                ? { ...service, invoiceFile: uploadedFile }
                : service
            ),
          };
        }

        return {
          ...prev,
          payments: prev.payments.map((payment) =>
            payment.id === itemId
              ? { ...payment, receiptFile: uploadedFile }
              : payment
          ),
        };
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const saveOrderDetails = async () => {
    if (!orderDetails) return;

    try {
      setSavingDetails(true);
      const totalCost = safeNum(orderDetails.order.totalCost);
      const totalProfit = editFullAmount - totalCost;
      const remainingAmount = editFullAmount - editPaidAmount;

      await updateDoc(doc(db, "salesOrders", orderDetails.order.id), {
        status: editStatus,
        fullAmount: editFullAmount,
        totalPrice: editFullAmount,
        paidAmount: editPaidAmount,
        remainingAmount,
        totalProfit,
        updatedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderDetails.order.id
            ? {
                ...order,
                status: editStatus,
                fullAmount: editFullAmount,
                totalPrice: editFullAmount,
                paidAmount: editPaidAmount,
                remainingAmount,
                totalProfit,
              }
            : order
        )
      );
      setOrderDetails((prev) =>
        prev
          ? {
              ...prev,
              order: {
                ...prev.order,
                status: editStatus,
                fullAmount: editFullAmount,
                totalPrice: editFullAmount,
                paidAmount: editPaidAmount,
                remainingAmount,
                totalProfit,
              },
            }
          : prev
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const attachmentState = (file: UploadedFile, label: string) => {
    if (hasAttachment(file)) {
      return (
        <Button asChild size="sm" variant="outline">
          <a href={file?.url} target="_blank" rel="noreferrer">
            <Paperclip className="h-4 w-4" />
            {label}
          </a>
        </Button>
      );
    }

    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
        <FileWarning className="h-3.5 w-3.5" />
        Missing Attachment
      </div>
    );
  };

  const uploadInput = (
    kind: "service" | "payment",
    itemId: string,
    label: string
  ) => (
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted">
      <Upload className="h-4 w-4" />
      {uploadingKey === `${kind}-${itemId}` ? "Uploading..." : label}
      <input
        type="file"
        className="hidden"
        disabled={uploadingKey === `${kind}-${itemId}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadOrderFile(kind, itemId, file);
          event.target.value = "";
        }}
      />
    </label>
  );

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
                        <TableHead>Order ID</TableHead>
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
                      {filteredOrders.map((o) => (
                            <TableRow
                              key={o.id}
                              className="cursor-pointer"
                              onClick={() => loadOrderDetails(o.id)}
                            >
                              <TableCell className="font-medium">
                                {displayOrderNumber(o)}
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    loadOrderDetails(o.id);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" /> Details
                                </Button>
                              </TableCell>
                            </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Sales Order Details</DialogTitle>
            <DialogDescription>
              Review and update order information, service invoices, and payment receipts.
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading order details...
            </div>
          ) : orderDetails ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="mt-1 font-semibold">
                    {orderDetails.customer?.name || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {orderDetails.customer?.phone || "-"}
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Order ID</div>
                  <div className="mt-1 truncate text-sm font-semibold">
                    {displayOrderNumber(orderDetails.order)}
                  </div>
                </div>
                <div className="rounded-md border bg-emerald-50 p-3 text-emerald-800">
                  <div className="text-xs opacity-80">Paid Amount</div>
                  <div className="mt-1 font-semibold">
                    {formatMoney(orderDetails.order.paidAmount)}
                  </div>
                </div>
                <div className="rounded-md border bg-amber-50 p-3 text-amber-800">
                  <div className="text-xs opacity-80">Remaining</div>
                  <div className="mt-1 font-semibold">
                    {formatMoney(orderDetails.order.remainingAmount)}
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Edit Order</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <div>
                    <Label className="my-2">Status</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={editStatus}
                      onChange={(event) => setEditStatus(event.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <Label className="my-2">Full Amount</Label>
                    <Input
                      type="number"
                      value={editFullAmount}
                      onChange={(event) =>
                        setEditFullAmount(safeNum(event.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label className="my-2">Paid Amount</Label>
                    <Input
                      type="number"
                      value={editPaidAmount}
                      onChange={(event) =>
                        setEditPaidAmount(safeNum(event.target.value))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={saveOrderDetails} disabled={savingDetails}>
                      <Save className="h-4 w-4" />
                      {savingDetails ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border">
                <div className="border-b bg-muted/20 px-4 py-3">
                  <div className="font-semibold">Services</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Service</th>
                        <th className="px-4 py-3 text-left font-medium">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right font-medium">Cost</th>
                        <th className="px-4 py-3 text-left font-medium">Invoice</th>
                        <th className="px-4 py-3 text-left font-medium">Upload</th>
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
                            {formatMoney(service.cost ?? service.price)}
                          </td>
                          <td className="px-4 py-3">
                            {attachmentState(service.invoiceFile || null, "Invoice")}
                          </td>
                          <td className="px-4 py-3">
                            {uploadInput("service", service.id, "Upload Invoice")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b bg-muted/20 px-4 py-3">
                  <div className="font-semibold">Customer Payments</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Method</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 text-right font-medium">Fee</th>
                        <th className="px-4 py-3 text-left font-medium">Receipt</th>
                        <th className="px-4 py-3 text-left font-medium">Upload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetails.payments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No customer payments found.
                          </td>
                        </tr>
                      ) : (
                        orderDetails.payments.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="px-4 py-3 text-muted-foreground">
                              {payment.createdAt?.seconds
                                ? format(
                                    new Date(payment.createdAt.seconds * 1000),
                                    "yyyy-MM-dd"
                                  )
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              {payment.paymentMethodName || "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {formatMoney(payment.amount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatMoney(payment.paymentMethodFeeAmount)}
                            </td>
                            <td className="px-4 py-3">
                              {attachmentState(payment.receiptFile || null, "Receipt")}
                            </td>
                            <td className="px-4 py-3">
                              {uploadInput("payment", payment.id, "Upload Receipt")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
