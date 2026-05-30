"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { format } from "date-fns";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { ArrowLeft, CheckCircle, Clock, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/* ---------------- Types ---------------- */

type Order = {
  customerId: string;
  status: string;
  totalCost: number;
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
  cost: number;
  price: number;
  profit: number;
};

type PaymentMethod = {
  id: string;
  name: string;
  percentageRate?: number;
  fixedFee?: number;
  currency?: "SAR";
  isActive?: boolean;
};

/* ---------------- Page ---------------- */

export default function SalesOrderDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentMethodName, setPaymentMethodName] = useState("");
  const [paymentMethodPercentageRate, setPaymentMethodPercentageRate] = useState(0);
  const [paymentMethodFixedFee, setPaymentMethodFixedFee] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !id) return;

    (async () => {
      try {
        // Order
        const orderRef = doc(db, "salesOrders", id as string);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          toast.error("Order not found");
          router.push("/sales");
          return;
        }

        const orderData = orderSnap.data() as Order;
        setOrder(orderData);

        // Customer
        const custSnap = await getDoc(
          doc(db, "customers", orderData.customerId)
        );
        if (custSnap.exists()) setCustomer(custSnap.data());

        // Services
        const servicesSnap = await getDocs(
          collection(db, "salesOrders", id as string, "services")
        );
        setServices(
          servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Service[]
        );

        const paymentMethodsSnap = await getDocs(collection(db, "paymentMethods"));
        const methods = paymentMethodsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentMethod[];
        setPaymentMethods(
          methods
            .filter((method) => method.isActive !== false)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      } catch (e) {
        console.error(e);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, id, router, user]);

  const updateStatus = async (status: string) => {
    try {
      await updateDoc(doc(db, "salesOrders", id as string), { status });
      setOrder((prev) => (prev ? { ...prev, status } : prev));
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const safeNum = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const calculatePaymentMethodFee = (
    amount: number,
    percentageRate: number,
    fixedFee: number
  ) => {
    if (safeNum(amount) <= 0) return 0;
    const fee = safeNum(amount) * (safeNum(percentageRate) / 100) + safeNum(fixedFee);
    return Math.round(fee * 100) / 100;
  };

  const addCustomerPayment = async () => {
    if (!order) return;

    const amount = safeNum(paymentAmount);
    const currentPaid = safeNum(order.paidAmount);
    const fullAmount = safeNum(order.fullAmount ?? order.totalPrice);
    const currentRemaining = safeNum(order.remainingAmount ?? fullAmount - currentPaid);

    if (amount <= 0) {
      toast.error("Enter a payment amount.");
      return;
    }

    if (!paymentMethodId) {
      toast.error("Select a payment method.");
      return;
    }

    if (!receiptFile) {
      toast.error("Receipt upload is required.");
      return;
    }

    if (amount > currentRemaining) {
      toast.error("Payment cannot exceed the remaining amount.");
      return;
    }

    try {
      setSavingPayment(true);
      const paymentMethodFeeAmount = calculatePaymentMethodFee(
        amount,
        paymentMethodPercentageRate,
        paymentMethodFixedFee
      );

      const paymentRef = await addDoc(
        collection(db, "salesOrders", id as string, "payments"),
        {
          amount,
          paymentMethodId,
          paymentMethodName,
          paymentMethodPercentageRate,
          paymentMethodFixedFee,
          paymentMethodFeeAmount,
          note: paymentNote.trim(),
          receiptFile: null,
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
        }
      );

      const filePath = `salesOrders/${id}/payments/${paymentRef.id}/receipt/${Date.now()}-${receiptFile.name}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, receiptFile);
      const url = await getDownloadURL(fileRef);
      const uploadedFile = {
        name: receiptFile.name,
        url,
        path: filePath,
      };

      await updateDoc(paymentRef, {
        receiptFile: uploadedFile,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "accountingEntries"), {
        orderId: id as string,
        customerId: order.customerId,
        direction: "in",
        sourceType: "customer_payment",
        amount,
        currency: "SAR",
        paymentMethodId,
        paymentMethodName,
        paymentMethodPercentageRate,
        paymentMethodFixedFee,
        paymentMethodFeeAmount,
        description: paymentNote.trim() || "Customer payment",
        file: uploadedFile,
        status: "pending",
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        confirmedBy: null,
        confirmedAt: null,
        paymentId: paymentRef.id,
      });

      if (paymentMethodFeeAmount > 0) {
        await addDoc(collection(db, "accountingEntries"), {
          orderId: id as string,
          customerId: order.customerId,
          direction: "out",
          sourceType: "payment_method_fee",
          amount: paymentMethodFeeAmount,
          currency: "SAR",
          paymentMethodId,
          paymentMethodName,
          paymentMethodPercentageRate,
          paymentMethodFixedFee,
          paymentMethodFeeAmount,
          description: `Payment method fee - ${paymentMethodName}`,
          file: uploadedFile,
          status: "pending",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          confirmedBy: null,
          confirmedAt: null,
          paymentId: paymentRef.id,
        });
      }

      const paidAmount = currentPaid + amount;
      const remainingAmount = fullAmount - paidAmount;

      await updateDoc(doc(db, "salesOrders", id as string), {
        paidAmount,
        remainingAmount,
        updatedAt: serverTimestamp(),
      });

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              paidAmount,
              remainingAmount,
              fullAmount,
            }
          : prev
      );
      setPaymentAmount(0);
      setPaymentMethodId("");
      setPaymentMethodName("");
      setPaymentMethodPercentageRate(0);
      setPaymentMethodFixedFee(0);
      setPaymentNote("");
      setReceiptFile(null);
      toast.success("Customer payment added");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add customer payment");
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading || !order) return null;

  const fullAmount = safeNum(order.fullAmount ?? order.totalPrice);
  const paidAmount = safeNum(order.paidAmount);
  const remainingAmount = safeNum(order.remainingAmount ?? fullAmount - paidAmount);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Sales Order Details</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="p-6 max-w-5xl space-y-6">
            {/* CUSTOMER */}
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p><b>Name:</b> {customer?.name}</p>
                <p><b>Phone:</b> {customer?.phone}</p>
                <p><b>Nationality:</b> {customer?.nationality}</p>
              </CardContent>
            </Card>

            {/* SERVICES */}
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="border rounded-lg p-3 flex justify-between"
                  >
                    <div>
                      <p className="font-medium">{s.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>Cost: {s.cost} SAR</p>
                      <p>Price: {s.price} SAR</p>
                      <p className="text-emerald-600">
                        Profit: {s.profit} SAR
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* TOTALS */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 font-medium md:grid-cols-5">
                <div>Total Cost: {order.totalCost} SAR</div>
                <div>Full Amount: {fullAmount} SAR</div>
                <div>Paid: {paidAmount} SAR</div>
                <div>Remaining: {remainingAmount} SAR</div>
                <div className="text-emerald-600">
                  Profit: {order.totalProfit} SAR
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Customer Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <Label className="my-2">Amount (SAR)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(safeNum(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label className="my-2">Payment Method</Label>
                    <select
                      className="h-10 w-full rounded border bg-background px-2"
                      value={paymentMethodId}
                      onChange={(e) => {
                        const selected = paymentMethods.find(
                          (method) => method.id === e.target.value
                        );
                        setPaymentMethodId(selected?.id || "");
                        setPaymentMethodName(selected?.name || "");
                        setPaymentMethodPercentageRate(
                          safeNum(selected?.percentageRate)
                        );
                        setPaymentMethodFixedFee(safeNum(selected?.fixedFee));
                      }}
                    >
                      <option value="">
                        {paymentMethods.length
                          ? "Select method"
                          : "No methods available"}
                      </option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                    {paymentMethodId && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Fee:{" "}
                        {calculatePaymentMethodFee(
                          paymentAmount,
                          paymentMethodPercentageRate,
                          paymentMethodFixedFee
                        )}{" "}
                        SAR ({paymentMethodPercentageRate}% +{" "}
                        {paymentMethodFixedFee} SAR)
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="my-2">Note</Label>
                    <Input
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Customer payment"
                    />
                  </div>

                  <div>
                    <Label className="my-2">Receipt</Label>
                    <Input
                      type="file"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={addCustomerPayment} disabled={savingPayment}>
                    <Upload className="w-4 h-4 mr-1" />
                    {savingPayment ? "Saving..." : "Add Payment"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* STATUS */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <span className="capitalize">{order.status}</span>

                {order.status !== "approved" && (
                  <Button
                    size="sm"
                    onClick={() => updateStatus("approved")}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                )}

                {order.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus("completed")}
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                )}
              </CardContent>
            </Card>

            <Button
              variant="outline"
              onClick={() => router.push("/sales")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
