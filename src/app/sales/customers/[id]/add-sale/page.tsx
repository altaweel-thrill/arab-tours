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
import { Plus, Save, ArrowLeft, Trash2 } from "lucide-react";
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

type UploadedPaymentFile = {
  name: string;
  url: string;
  path: string;
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
    visaId: null,
    visaSnapshot: null,
  });
}

/* ---------------- Page ---------------- */

export default function AddSalesOrderPage() {
  const { id: customerId } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<CustomerInfo>({});
  const [visas, setVisas] = useState<VisaCatalogItem[]>([]);
  const [loadingVisas, setLoadingVisas] = useState(false);
  const [saving, setSaving] = useState(false);

  const [services, setServices] = useState<ServiceItem[]>([newService("Flight")]);

  // ✅ يكتب يدويًا من الموظف
  const [fullAmount, setFullAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  // ✅ ملفات متعددة فقط
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);

  const totals = useMemo(() => {
    const totalCost = services.reduce((a, s) => a + safeNum(s.cost), 0);
    const remainingAmount = Math.max(0, safeNum(fullAmount) - safeNum(paidAmount));
    const totalProfit = safeNum(fullAmount) - totalCost;

    return {
      totalCost,
      totalPrice: safeNum(fullAmount),
      totalProfit,
      remainingAmount,
    };
  }, [services, fullAmount, paidAmount]);

  /* -------- Fetch customer -------- */

  useEffect(() => {
    if (!customerId) return;

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
  }, [customerId]);

  /* -------- Fetch visaCatalog -------- */

  useEffect(() => {
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
  }, []);

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

      copy[index] = recalcLine(current);
      return copy;
    });
  };

  const onSelectVisa = (serviceIndex: number, visaId: string) => {
    const selected = visas.find((v) => v.id === visaId);
    if (!selected) return;

    const label = `${selected.flag ?? ""} ${selected.countryName} – ${selected.visaType} | ${selected.visaCategory}${
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

      // ✅ الكوست الابتدائي من الفيزا
      current.unitCost = safeNum(selected.priceFrom);

      copy[serviceIndex] = recalcLine(current);
      return copy;
    });
  };

  const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPaymentFiles(files);
  };

  const uploadPaymentFiles = async (orderId: string) => {
    if (!paymentFiles.length) return [];

    const uploaded: UploadedPaymentFile[] = [];

    for (const file of paymentFiles) {
      const filePath = `salesOrders/${orderId}/payments/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      uploaded.push({
        name: file.name,
        url,
        path: filePath,
      });
    }

    return uploaded;
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

    if (safeNum(fullAmount) <= 0) {
      toast.error("Please enter the full amount.");
      return;
    }

    if (safeNum(paidAmount) > safeNum(fullAmount)) {
      toast.error("Paid amount cannot be greater than full amount.");
      return;
    }

    try {
      setSaving(true);

      const orderRef = await addDoc(collection(db, "salesOrders"), {
        customerId,
        createdBy: user?.uid || null,
        status: "pending",

        totalCost: totals.totalCost,
        totalPrice: totals.totalPrice,
        totalProfit: totals.totalProfit,

        fullAmount: safeNum(fullAmount),
        paidAmount: safeNum(paidAmount),
        remainingAmount: totals.remainingAmount,

        paymentFiles: [],

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const raw of services) {
        const s = recalcLine(raw);

        await addDoc(collection(db, "salesOrders", orderRef.id, "services"), {
          type: s.type,
          description: s.description || "",
          qty: s.qty,
          unitCost: s.unitCost,
          cost: s.cost,

          visaId: s.type === "Visa" ? s.visaId ?? null : null,
          visaSnapshot: s.type === "Visa" ? s.visaSnapshot ?? null : null,

          createdAt: serverTimestamp(),
        });
      }

      const uploadedFiles = await uploadPaymentFiles(orderRef.id);

      if (uploadedFiles.length > 0) {
        await updateDoc(doc(db, "salesOrders", orderRef.id), {
          paymentFiles: uploadedFiles,
          updatedAt: serverTimestamp(),
        });
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
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={addService}>
                  <Plus className="w-4 h-4 mr-1" /> Add Service
                </Button>

                <Separator />

                {/* Payment Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-medium">
                  <div>Total Cost: {totals.totalCost} SAR</div>
                  <div>Full Amount: {totals.totalPrice} SAR</div>
                  <div className="text-emerald-600">
                    Profit: {totals.totalProfit} SAR
                  </div>
                  <div>Remaining: {totals.remainingAmount} SAR</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="my-2">Full Amount</Label>
                    <Input
                      type="number"
                      value={fullAmount}
                      onChange={(e) => setFullAmount(safeNum(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label className="my-2">Paid Amount</Label>
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(safeNum(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label className="my-2">Remaining Amount</Label>
                    <Input value={totals.remainingAmount} disabled />
                  </div>
                </div>

                <Separator />

                {/* Payment Files */}
                <div className="space-y-3">
                  <div>
                    <Label className="my-2">Upload Payment Files</Label>
                    <Input type="file" multiple onChange={onSelectFiles} />
                  </div>

                  {paymentFiles.length > 0 && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {paymentFiles.map((file, index) => (
                        <div key={index}>{file.name}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/sales/customers/${customerId}`)}
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