"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
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
import { Plus, Save, ArrowLeft, Trash2, FileText } from "lucide-react";
import NotificationsBell from "@/components/notifications/NotificationsBell";

/* ---------------- Types ---------------- */

type VisaCatalogItem = {
  id: string;
  countryName: string;
  countryCode?: string;
  flag?: string;
  visaType: string;
  visaCategory: string;
  priceFrom: number;
  durationDays?: number | null;
  isActive: boolean;
};

type ServiceItem = {
  type: string;
  description: string;
  qty: number;
  unitCost: number;
  cost: number;
  invoiceFile?: File | null;

  // flight
  from?: string;
  to?: string;
  provider?: string;

  // hotel
  hotelDays?: number;
  hotelStars?: string;
  hotelProvider?: string;
  roomsCount?: number;

  // visa
  visaId?: string | null;
  visaSnapshot?: {
    countryName?: string;
    flag?: string;
    visaType?: string;
    visaCategory?: string;
    durationDays?: number | null;
    priceFrom?: number;
  } | null;
};

type CustomerInfo = {
  name?: string;
  phone?: string;
  nationality?: string;
};

type UploadedFile = {
  name: string;
  url: string;
  path: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  percentageRate?: number;
  fixedFee?: number;
  currency?: "SAR";
  isActive?: boolean;
};

type CustomerPayment = {
  amount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodPercentageRate: number;
  paymentMethodFixedFee: number;
  note: string;
  receiptFile: File | null;
};

/* ---------------- Helpers ---------------- */

function clampQty(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.floor(v));
}

function safeNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatOrderNumber(year: number, sequence: number) {
  return `ORD-${year}-${String(sequence).padStart(4, "0")}`;
}

function calculatePaymentMethodFee(
  amount: number,
  percentageRate: number,
  fixedFee: number
) {
  if (safeNum(amount) <= 0) return 0;
  const fee = safeNum(amount) * (safeNum(percentageRate) / 100) + safeNum(fixedFee);
  return Math.round(fee * 100) / 100;
}

function recalcLine(s: ServiceItem): ServiceItem {
  const qty = clampQty(s.qty);
  const unitCost = safeNum(s.unitCost);

  return {
    ...s,
    qty,
    unitCost,
    cost: unitCost * qty,
  };
}

function newService(type: string = "Flight"): ServiceItem {
  return recalcLine({
    type,
    description: "",
    qty: 1,
    unitCost: 0,
    cost: 0,
    invoiceFile: null,

    from: "",
    to: "",
    provider: "",

    hotelDays: 1,
    hotelStars: "",
    hotelProvider: "",
    roomsCount: 1,

    visaId: null,
    visaSnapshot: null,
  });
}

/* ---------------- Page ---------------- */

export default function AddSalesOrderPage() {
  const { id: customerId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [customer, setCustomer] = useState<CustomerInfo>({});
  const [visas, setVisas] = useState<VisaCatalogItem[]>([]);
  const [loadingVisas, setLoadingVisas] = useState(false);
  const [saving, setSaving] = useState(false);

  const [services, setServices] = useState<ServiceItem[]>([
    newService("Flight"),
  ]);

  const [fullAmount, setFullAmount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([
    {
      amount: 0,
      paymentMethodId: "",
      paymentMethodName: "",
      paymentMethodPercentageRate: 0,
      paymentMethodFixedFee: 0,
      note: "",
      receiptFile: null,
    },
  ]);

  const totals = useMemo(() => {
    const totalCost = services.reduce((a, s) => a + safeNum(s.cost), 0);
    const paidAmount = payments.reduce((a, p) => a + safeNum(p.amount), 0);
    const remainingAmount = safeNum(fullAmount) - safeNum(paidAmount);
    const totalProfit = safeNum(fullAmount) - totalCost;

    return {
      totalCost,
      totalPrice: safeNum(fullAmount),
      paidAmount,
      totalProfit,
      remainingAmount,
    };
  }, [services, fullAmount, payments]);

  /* -------- Fetch customer -------- */

  useEffect(() => {
    if (authLoading || !user || !customerId) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "customers", customerId as string));
        if (snap.exists()) {
          const data = snap.data();
          setCustomer({
            name: data.name,
            phone: data.phone,
            nationality: data.nationality,
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load customer info");
      }
    })();
  }, [authLoading, customerId, user]);

  /* -------- Fetch visaCatalog -------- */

  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        setLoadingVisas(true);

        const q = query(
          collection(db, "visaCatalog"),
          where("isActive", "==", true)
        );
        const snap = await getDocs(q);

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as VisaCatalogItem[];

        data.sort((a, b) => {
          const an = (a.countryName || "").toLowerCase();
          const bn = (b.countryName || "").toLowerCase();
          if (an < bn) return -1;
          if (an > bn) return 1;
          return 0;
        });

        setVisas(data);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load visa catalog");
      } finally {
        setLoadingVisas(false);
      }
    })();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        const snap = await getDocs(collection(db, "paymentMethods"));
        const methods = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentMethod[];

        setPaymentMethods(
          methods
            .filter((method) => method.isActive !== false)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      } catch (e) {
        console.error(e);
        toast.error("Failed to load payment methods");
      }
    })();
  }, [authLoading, user]);

  /* -------- Handlers -------- */

  const addService = () => {
    setServices((prev) => [...prev, newService("Flight")]);
  };

  const removeService = (index: number) => {
    setServices((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateService = (index: number, patch: Partial<ServiceItem>) => {
    setServices((prev) => {
      const copy = [...prev];
      const current = { ...(copy[index] as ServiceItem), ...patch };
      copy[index] = recalcLine(current);
      return copy;
    });
  };

  const onChangeServiceType = (index: number, newType: string) => {
    setServices((prev) => {
      const copy = [...prev];
      const current = { ...(copy[index] as ServiceItem) };

      current.type = newType;

      if (newType !== "Visa") {
        current.visaId = null;
        current.visaSnapshot = null;
      }

      if (newType !== "Flight") {
        current.from = "";
        current.to = "";
        current.provider = "";
      }

      if (newType !== "Hotel") {
        current.hotelDays = 1;
        current.hotelStars = "";
        current.hotelProvider = "";
        current.roomsCount = 1;
      }

      copy[index] = recalcLine(current);
      return copy;
    });
  };

  const onSelectVisa = (serviceIndex: number, visaId: string) => {
    const selected = visas.find((v) => v.id === visaId);
    if (!selected) return;

    const label = `${selected.flag ?? ""} ${selected.countryName} – ${
      selected.visaType
    } | ${selected.visaCategory}${
      typeof selected.durationDays === "number" && selected.durationDays > 0
        ? ` | ${selected.durationDays} days`
        : ""
    }`;

    setServices((prev) => {
      const copy = [...prev];
      const current = { ...(copy[serviceIndex] as ServiceItem) };

      current.type = "Visa";
      current.visaId = selected.id;
      current.visaSnapshot = {
        countryName: selected.countryName,
        flag: selected.flag,
        visaType: selected.visaType,
        visaCategory: selected.visaCategory,
        durationDays: selected.durationDays ?? null,
        priceFrom: selected.priceFrom,
      };

      current.description = label;
      current.unitCost = safeNum(selected.priceFrom);

      copy[serviceIndex] = recalcLine(current);
      return copy;
    });
  };

  const addPayment = () => {
    setPayments((prev) => [
      ...prev,
      {
        amount: 0,
        paymentMethodId: "",
        paymentMethodName: "",
        paymentMethodPercentageRate: 0,
        paymentMethodFixedFee: 0,
        note: "",
        receiptFile: null,
      },
    ]);
  };

  const updatePayment = (index: number, patch: Partial<CustomerPayment>) => {
    setPayments((prev) =>
      prev.map((payment, i) =>
        i === index ? { ...payment, ...patch } : payment
      )
    );
  };

  const removePayment = (index: number) => {
    setPayments((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadSingleFile = async (
    file: File,
    filePath: string
  ): Promise<UploadedFile> => {
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return {
      name: file.name,
      url,
      path: filePath,
    };
  };

  const saveOrder = async () => {
    if (!services.length) {
      toast.error("Add at least one service");
      return;
    }

    const hasInvalidVisa = services.some(
      (s) => s.type === "Visa" && !s.visaId
    );
    if (hasInvalidVisa) {
      toast.error("Please select a Visa from the list.");
      return;
    }

    const hasInvalidFlight = services.some(
      (s) =>
        s.type === "Flight" &&
        (!s.from?.trim() ||
          !s.to?.trim() ||
          !s.provider?.trim() ||
          safeNum(s.qty) <= 0 ||
          safeNum(s.unitCost) <= 0)
    );
    if (hasInvalidFlight) {
      toast.error("Please complete all flight fields.");
      return;
    }

    const hasInvalidHotel = services.some(
      (s) =>
        s.type === "Hotel" &&
        (!safeNum(s.hotelDays) ||
          !s.hotelStars?.trim() ||
          !s.hotelProvider?.trim() ||
          !safeNum(s.roomsCount) ||
          safeNum(s.qty) <= 0 ||
          safeNum(s.unitCost) <= 0)
    );
    if (hasInvalidHotel) {
      toast.error("Please complete all hotel fields.");
      return;
    }

    if (safeNum(fullAmount) <= 0) {
      toast.error("Please enter the full amount.");
      return;
    }

    if (totals.paidAmount > safeNum(fullAmount)) {
      toast.error("Customer payments cannot exceed the full amount.");
      return;
    }

    const enteredPayments = payments.filter((p) => safeNum(p.amount) > 0);
    const missingPaymentMethods = enteredPayments.some((p) => !p.paymentMethodId);
    if (missingPaymentMethods) {
      toast.error("Please select a payment method for every customer payment.");
      return;
    }

    const missingReceipts = enteredPayments.some((p) => !p.receiptFile);
    if (missingReceipts) {
      toast.error("Receipt upload is required for every customer payment.");
      return;
    }

    try {
      setSaving(true);

      const orderRef = doc(collection(db, "salesOrders"));
      const orderYear = new Date().getFullYear();
      const counterRef = doc(db, "counters", `salesOrders-${orderYear}`);
      const orderNumber = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const lastNumber = counterSnap.exists()
          ? safeNum(counterSnap.data().lastNumber)
          : 0;
        const nextNumber = lastNumber + 1;
        const nextOrderNumber = formatOrderNumber(orderYear, nextNumber);

        transaction.set(
          counterRef,
          {
            lastNumber: nextNumber,
            year: orderYear,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(orderRef, {
          orderNumber: nextOrderNumber,
          orderNumberYear: orderYear,
          orderNumberSequence: nextNumber,
          customerId,
          createdBy: user?.uid || null,
          status: "pending",

          totalCost: totals.totalCost,
          totalPrice: totals.totalPrice,
          totalProfit: totals.totalProfit,

          fullAmount: safeNum(fullAmount),
          paidAmount: totals.paidAmount,
          remainingAmount: totals.remainingAmount,
          paymentsCount: enteredPayments.length,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return nextOrderNumber;
      });

      for (const raw of services) {
        const s = recalcLine(raw);

        const serviceRef = await addDoc(collection(db, "salesOrders", orderRef.id, "services"), {
          type: s.type,
          description: s.description || "",
          qty: s.qty,
          unitCost: s.unitCost,
          cost: s.cost,

          // flight
          from: s.type === "Flight" ? s.from?.trim() || null : null,
          to: s.type === "Flight" ? s.to?.trim() || null : null,
          provider: s.type === "Flight" ? s.provider?.trim() || null : null,

          // hotel
          hotelDays: s.type === "Hotel" ? safeNum(s.hotelDays) : null,
          hotelStars: s.type === "Hotel" ? s.hotelStars?.trim() || null : null,
          hotelProvider:
            s.type === "Hotel" ? s.hotelProvider?.trim() || null : null,
          roomsCount: s.type === "Hotel" ? safeNum(s.roomsCount) : null,

          // visa
          visaId: s.type === "Visa" ? s.visaId ?? null : null,
          visaSnapshot: s.type === "Visa" ? s.visaSnapshot ?? null : null,
          invoiceFile: null,

          createdAt: serverTimestamp(),
        });

        let invoiceFile: UploadedFile | null = null;
        if (s.invoiceFile) {
          invoiceFile = await uploadSingleFile(
            s.invoiceFile,
            `salesOrders/${orderRef.id}/services/${serviceRef.id}/invoice/${Date.now()}-${s.invoiceFile.name}`
          );
          await updateDoc(serviceRef, {
            invoiceFile,
            updatedAt: serverTimestamp(),
          });
        }

        await addDoc(collection(db, "accountingEntries"), {
          orderId: orderRef.id,
          customerId,
          direction: "out",
          sourceType: "service_cost",
          amount: s.cost,
          currency: "SAR",
          description: s.description || `${s.type} service cost`,
          orderNumber,
          file: invoiceFile,
          status: "pending",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          confirmedBy: null,
          confirmedAt: null,
          serviceId: serviceRef.id,
        });
      }

      for (const payment of enteredPayments) {
        const paymentMethodFeeAmount = calculatePaymentMethodFee(
          safeNum(payment.amount),
          payment.paymentMethodPercentageRate,
          payment.paymentMethodFixedFee
        );

        const paymentRef = await addDoc(
          collection(db, "salesOrders", orderRef.id, "payments"),
          {
            amount: safeNum(payment.amount),
            paymentMethodId: payment.paymentMethodId,
            paymentMethodName: payment.paymentMethodName,
            paymentMethodPercentageRate: payment.paymentMethodPercentageRate,
            paymentMethodFixedFee: payment.paymentMethodFixedFee,
            paymentMethodFeeAmount,
            note: payment.note.trim(),
            receiptFile: null,
            createdBy: user?.uid || null,
            createdAt: serverTimestamp(),
          }
        );

        const receiptFile = await uploadSingleFile(
          payment.receiptFile as File,
          `salesOrders/${orderRef.id}/payments/${paymentRef.id}/receipt/${Date.now()}-${payment.receiptFile?.name}`
        );

        await updateDoc(paymentRef, {
          receiptFile,
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, "accountingEntries"), {
          orderId: orderRef.id,
          customerId,
          direction: "in",
          sourceType: "customer_payment",
          amount: safeNum(payment.amount),
          currency: "SAR",
          orderNumber,
          paymentMethodId: payment.paymentMethodId,
          paymentMethodName: payment.paymentMethodName,
          paymentMethodPercentageRate: payment.paymentMethodPercentageRate,
          paymentMethodFixedFee: payment.paymentMethodFixedFee,
          paymentMethodFeeAmount,
          description: payment.note.trim() || "Customer payment",
          file: receiptFile,
          status: "pending",
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          confirmedBy: null,
          confirmedAt: null,
          paymentId: paymentRef.id,
        });

        if (paymentMethodFeeAmount > 0) {
          await addDoc(collection(db, "accountingEntries"), {
            orderId: orderRef.id,
            customerId,
            direction: "out",
            sourceType: "payment_method_fee",
            amount: paymentMethodFeeAmount,
            currency: "SAR",
            orderNumber,
            paymentMethodId: payment.paymentMethodId,
            paymentMethodName: payment.paymentMethodName,
            paymentMethodPercentageRate: payment.paymentMethodPercentageRate,
            paymentMethodFixedFee: payment.paymentMethodFixedFee,
            paymentMethodFeeAmount,
            description: `Payment method fee - ${payment.paymentMethodName}`,
            file: receiptFile,
            status: "pending",
            createdBy: user?.uid || null,
            createdAt: serverTimestamp(),
            confirmedBy: null,
            confirmedAt: null,
            paymentId: paymentRef.id,
          });
        }
      }

      toast.success("Sales order created successfully");
      router.push(`/sales/orders/${orderRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create sales order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.add">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">New Sales Order</h2>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="p-6 max-w-5xl space-y-6">
            {/* Customer */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="my-2">Name</Label>
                  <Input value={customer.name || "-"} disabled />
                </div>
                <div>
                  <Label className="my-2">Phone</Label>
                  <Input value={customer.phone || "-"} disabled />
                </div>
                <div>
                  <Label className="my-2">Nationality</Label>
                  <Input value={customer.nationality || "-"} disabled />
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {services.map((s, i) => (
                  <div key={i} className="border p-3 rounded-lg space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div className="w-full md:max-w-[220px]">
                        <Label className="my-2">Type</Label>
                        <select
                          className="w-full border rounded h-10 px-2 bg-background"
                          value={s.type}
                          onChange={(e) =>
                            onChangeServiceType(i, e.target.value)
                          }
                        >
                          <option>Flight</option>
                          <option>Hotel</option>
                          <option>Visa</option>
                          <option>Car</option>
                          <option>Other</option>
                        </select>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeService(i)}
                        disabled={services.length <= 1}
                        title={
                          services.length <= 1
                            ? "Cannot delete last service"
                            : "Delete service"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {s.type === "Visa" ? (
                        <div className="md:col-span-3">
                          <Label className="my-2">Visa (from catalog)</Label>
                          <select
                            className="w-full border rounded h-10 px-2 bg-background"
                            value={s.visaId ?? ""}
                            onChange={(e) => onSelectVisa(i, e.target.value)}
                            disabled={loadingVisas}
                          >
                            <option value="">
                              {loadingVisas
                                ? "Loading visas..."
                                : "Select visa"}
                            </option>

                            {visas.map((v) => (
                              <option key={v.id} value={v.id}>
                                {(v.flag ?? "") + " " + v.countryName} –{" "}
                                {v.visaType} | {v.visaCategory}
                                {typeof v.durationDays === "number" &&
                                v.durationDays > 0
                                  ? ` | ${v.durationDays} days`
                                  : ""}
                                {typeof v.priceFrom === "number"
                                  ? ` | from ${v.priceFrom} SAR`
                                  : ""}
                              </option>
                            ))}
                          </select>

                          <div className="mt-2">
                            <Label className="my-2">Description</Label>
                            <Input
                              value={s.description}
                              disabled
                              placeholder="Auto filled from catalog"
                            />
                          </div>
                        </div>
                      ) : s.type === "Flight" ? (
                        <div className="md:col-span-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label className="my-2">From</Label>
                              <Input
                                value={s.from || ""}
                                onChange={(e) =>
                                  updateService(i, { from: e.target.value })
                                }
                                placeholder="e.g. Riyadh"
                              />
                            </div>

                            <div>
                              <Label className="my-2">To</Label>
                              <Input
                                value={s.to || ""}
                                onChange={(e) =>
                                  updateService(i, { to: e.target.value })
                                }
                                placeholder="e.g. Cairo"
                              />
                            </div>

                            <div>
                              <Label className="my-2">Provider</Label>
                              <Input
                                value={s.provider || ""}
                                onChange={(e) =>
                                  updateService(i, { provider: e.target.value })
                                }
                                placeholder="e.g. Saudia"
                              />
                            </div>
                          </div>
                        </div>
                      ) : s.type === "Hotel" ? (
                        <div className="md:col-span-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="my-2">Number of Days</Label>
                              <Input
                                type="number"
                                min={1}
                                value={s.hotelDays ?? 1}
                                onChange={(e) =>
                                  updateService(i, {
                                    hotelDays: clampQty(e.target.value),
                                  })
                                }
                              />
                            </div>

                            <div>
                              <Label className="my-2">Hotel Stars</Label>
                              <select
                                className="w-full border rounded h-10 px-2 bg-background"
                                value={s.hotelStars || ""}
                                onChange={(e) =>
                                  updateService(i, {
                                    hotelStars: e.target.value,
                                  })
                                }
                              >
                                <option value="">Select stars</option>
                                <option value="1 Star">1 Star</option>
                                <option value="2 Stars">2 Stars</option>
                                <option value="3 Stars">3 Stars</option>
                                <option value="4 Stars">4 Stars</option>
                                <option value="5 Stars">5 Stars</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="my-2">Provider</Label>
                              <Input
                                value={s.hotelProvider || ""}
                                onChange={(e) =>
                                  updateService(i, {
                                    hotelProvider: e.target.value,
                                  })
                                }
                                placeholder="e.g. Booking.com"
                              />
                            </div>

                            <div>
                              <Label className="my-2">Number of Rooms</Label>
                              <Input
                                type="number"
                                min={1}
                                value={s.roomsCount ?? 1}
                                onChange={(e) =>
                                  updateService(i, {
                                    roomsCount: clampQty(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="md:col-span-3">
                          <Label className="my-2">Description</Label>
                          <Input
                            value={s.description}
                            onChange={(e) =>
                              updateService(i, {
                                description: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}

                      <div>
                        <Label className="my-2">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={s.qty}
                          onChange={(e) =>
                            updateService(i, {
                              qty: clampQty(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label className="my-2">Unit Cost (SAR)</Label>
                        <Input
                          type="number"
                          value={s.unitCost}
                          onChange={(e) =>
                            updateService(i, {
                              unitCost: safeNum(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="text-sm text-muted-foreground">
                          Line Cost:{" "}
                          <span className="font-medium text-foreground">
                            {recalcLine(s).cost} SAR
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Qty:{" "}
                          <span className="font-medium text-foreground">
                            {recalcLine(s).qty}
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-5">
                        <Label className="my-2">Service Invoice (optional)</Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            type="file"
                            onChange={(e) =>
                              updateService(i, {
                                invoiceFile: e.target.files?.[0] ?? null,
                              })
                            }
                          />
                          {s.invoiceFile && (
                            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="truncate">{s.invoiceFile.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={addService}>
                  <Plus className="w-4 h-4 mr-1" /> Add Service
                </Button>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-medium">
                  <div>Total Cost: {totals.totalCost} SAR</div>
                  <div>Full Amount: {totals.totalPrice} SAR</div>
                  <div>Paid: {totals.paidAmount} SAR</div>
                  <div className="text-emerald-600">
                    Profit: {totals.totalProfit} SAR
                  </div>
                  <div>Remaining: {totals.remainingAmount} SAR</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="my-2">Full Amount</Label>
                    <Input
                      type="number"
                      value={fullAmount}
                      onChange={(e) => setFullAmount(safeNum(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label className="my-2">Remaining Amount</Label>
                    <Input value={totals.remainingAmount} disabled />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Customer Payments</h3>
                      <p className="text-sm text-muted-foreground">
                        Each payment creates a pending accounting in entry.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addPayment}>
                      <Plus className="w-4 h-4 mr-1" /> Add Payment
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_1.2fr_auto]"
                      >
                        <div>
                          <Label className="my-2">Amount (SAR)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={payment.amount}
                            onChange={(e) =>
                              updatePayment(index, {
                                amount: safeNum(e.target.value),
                              })
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Payment Method</Label>
                          <select
                            className="h-10 w-full rounded border bg-background px-2"
                            value={payment.paymentMethodId}
                            onChange={(e) => {
                              const selected = paymentMethods.find(
                                (method) => method.id === e.target.value
                              );
                              updatePayment(index, {
                                paymentMethodId: selected?.id || "",
                                paymentMethodName: selected?.name || "",
                                paymentMethodPercentageRate: safeNum(
                                  selected?.percentageRate
                                ),
                                paymentMethodFixedFee: safeNum(selected?.fixedFee),
                              });
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
                          {payment.amount > 0 && !payment.paymentMethodId && (
                            <p className="mt-1 text-xs text-destructive">
                              Payment method is required.
                            </p>
                          )}
                          {payment.paymentMethodId && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Fee:{" "}
                              {calculatePaymentMethodFee(
                                payment.amount,
                                payment.paymentMethodPercentageRate,
                                payment.paymentMethodFixedFee
                              )}{" "}
                              SAR ({payment.paymentMethodPercentageRate}% +{" "}
                              {payment.paymentMethodFixedFee} SAR)
                            </p>
                          )}
                        </div>

                        <div>
                          <Label className="my-2">Note</Label>
                          <Input
                            value={payment.note}
                            onChange={(e) =>
                              updatePayment(index, { note: e.target.value })
                            }
                            placeholder="Customer payment"
                          />
                        </div>

                        <div>
                          <Label className="my-2">Receipt</Label>
                          <Input
                            type="file"
                            onChange={(e) =>
                              updatePayment(index, {
                                receiptFile: e.target.files?.[0] ?? null,
                              })
                            }
                          />
                          {payment.amount > 0 && !payment.receiptFile && (
                            <p className="mt-1 text-xs text-destructive">
                              Receipt is required for this payment.
                            </p>
                          )}
                        </div>

                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removePayment(index)}
                            disabled={payments.length <= 1}
                            title="Remove payment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/sales/customers/${customerId}`)
                    }
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>

                  <Button onClick={saveOrder} disabled={saving}>
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? "Saving..." : "Save Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
