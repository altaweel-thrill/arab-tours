"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { CreditCard, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type PaymentMethod = {
  id: string;
  name: string;
  percentageRate?: number;
  fixedFee?: number;
  currency?: "SAR";
  isActive?: boolean;
  createdAt?: any;
};

function safeNum(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function feeFormula(method: PaymentMethod) {
  return `${safeNum(method.percentageRate)}% + ${safeNum(method.fixedFee)} SAR`;
}

export default function PaymentMethodsPage() {
  const { user, loading: authLoading } = useAuth();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [percentageRate, setPercentageRate] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchMethods = async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "paymentMethods"));
        const data = snap.docs.map((methodDoc) => ({
          id: methodDoc.id,
          ...(methodDoc.data() as any),
        })) as PaymentMethod[];

        setMethods(
          data.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to load payment methods");
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [authLoading, user]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPercentageRate(0);
    setFixedFee(0);
  };

  const activeMethods = useMemo(
    () => methods.filter((method) => method.isActive !== false).length,
    [methods]
  );

  const saveMethod = async () => {
    const trimmedName = name.trim();
    const rate = safeNum(percentageRate);
    const fixed = safeNum(fixedFee);

    if (!trimmedName) {
      toast.error("Enter a payment method name.");
      return;
    }

    if (rate < 0 || fixed < 0) {
      toast.error("Fees cannot be negative.");
      return;
    }

    const duplicate = methods.some(
      (method) =>
        method.id !== editingId &&
        method.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error("This payment method already exists.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateDoc(doc(db, "paymentMethods", editingId), {
          name: trimmedName,
          percentageRate: rate,
          fixedFee: fixed,
          currency: "SAR",
          updatedBy: user?.uid || null,
          updatedAt: serverTimestamp(),
        });

        setMethods((prev) =>
          prev
            .map((method) =>
              method.id === editingId
                ? {
                    ...method,
                    name: trimmedName,
                    percentageRate: rate,
                    fixedFee: fixed,
                    currency: "SAR" as const,
                  }
                : method
            )
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
        toast.success("Payment method updated");
      } else {
        const methodRef = await addDoc(collection(db, "paymentMethods"), {
          name: trimmedName,
          percentageRate: rate,
          fixedFee: fixed,
          currency: "SAR",
          isActive: true,
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setMethods((prev) =>
          [
            ...prev,
            {
              id: methodRef.id,
              name: trimmedName,
              percentageRate: rate,
              fixedFee: fixed,
              currency: "SAR" as const,
              isActive: true,
            },
          ].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
        toast.success("Payment method added");
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save payment method");
    } finally {
      setSaving(false);
    }
  };

  const editMethod = (method: PaymentMethod) => {
    setEditingId(method.id);
    setName(method.name || "");
    setPercentageRate(safeNum(method.percentageRate));
    setFixedFee(safeNum(method.fixedFee));
  };

  const toggleStatus = async (method: PaymentMethod) => {
    const nextStatus = method.isActive === false;

    try {
      await updateDoc(doc(db, "paymentMethods", method.id), {
        isActive: nextStatus,
        updatedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });

      setMethods((prev) =>
        prev.map((item) =>
          item.id === method.id ? { ...item, isActive: nextStatus } : item
        )
      );
      toast.success(nextStatus ? "Payment method activated" : "Payment method paused");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update payment method status");
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="accounting.confirm">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Payment Methods</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="min-h-screen space-y-6 bg-muted/10 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border shadow-sm">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <div className="text-sm text-muted-foreground">Methods</div>
                    <div className="text-2xl font-semibold">{methods.length}</div>
                  </div>
                  <CreditCard className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Active</div>
                  <div className="text-2xl font-semibold">{activeMethods}</div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Currency</div>
                  <div className="text-2xl font-semibold">SAR</div>
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>{editingId ? "Edit Method" : "Add Method"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div>
                    <Label className="my-2">Method Name</Label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Mada, Bank Transfer, Cash..."
                    />
                  </div>

                  <div>
                    <Label className="my-2">Percentage (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={percentageRate}
                      onChange={(event) =>
                        setPercentageRate(safeNum(event.target.value))
                      }
                    />
                  </div>

                  <div>
                    <Label className="my-2">Fixed Fee (SAR)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={fixedFee}
                      onChange={(event) => setFixedFee(safeNum(event.target.value))}
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <Button onClick={saveMethod} disabled={saving}>
                      {editingId ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {saving ? "Saving..." : editingId ? "Save" : "Add"}
                    </Button>
                    {editingId && (
                      <Button variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Loading payment methods...
                  </div>
                ) : methods.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No payment methods found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-3 pr-3 font-medium">Method</th>
                          <th className="py-3 pr-3 font-medium">Formula</th>
                          <th className="py-3 pr-3 font-medium">Status</th>
                          <th className="py-3 pr-3 text-right font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {methods.map((method) => (
                          <tr key={method.id} className="border-b last:border-0">
                            <td className="py-4 pr-3 font-medium">
                              {method.name}
                            </td>
                            <td className="py-4 pr-3">{feeFormula(method)}</td>
                            <td className="py-4 pr-3">
                              <Badge
                                variant={
                                  method.isActive === false ? "outline" : "secondary"
                                }
                              >
                                {method.isActive === false ? "Paused" : "Active"}
                              </Badge>
                            </td>
                            <td className="py-4 pr-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => editMethod(method)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    method.isActive === false
                                      ? "default"
                                      : "secondary"
                                  }
                                  onClick={() => toggleStatus(method)}
                                >
                                  {method.isActive === false ? "Activate" : "Pause"}
                                </Button>
                              </div>
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
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
