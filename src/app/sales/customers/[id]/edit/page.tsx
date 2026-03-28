"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
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
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { usePrivilege } from "@/hooks/usePrivilege";

//
// ✅ Updated types
//
type FamilyMember = {
  name?: string | null;
  relation?: string | null;
  dob?: string | null;
  passportNo?: string | null;
  notes?: string | null;
};

type CustomerDoc = {
  name: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  passportNo?: string | null;
  address?: string | null;
  dob?: string | null;
  notes?: string | null;
  family?: FamilyMember[];
  createdAt?: any;
  createdBy?: string | null;
  updatedAt?: any;
  updatedBy?: string | null;
};

//
// ✅ Helper functions
//
function toDateInputValue(value?: any): string {
  if (!value) return "";
  try {
    if (typeof value === "object" && value?.seconds) {
      const d = new Date(value.seconds * 1000);
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function isoOrNullFromDateInput(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sanitize<T extends Record<string, any>>(obj: T): T {
  const entries = Object.entries(obj).map(([k, v]) => {
    if (Array.isArray(v)) {
      return [k, v.map((item) => {
        if (item && typeof item === "object") {
          const inner = Object.fromEntries(
            Object.entries(item).map(([ik, iv]) => [ik, iv ?? null])
          );
          return inner;
        }
        return v ?? null;
      })];
    }
    if (v && typeof v === "object") {
      const inner = Object.fromEntries(
        Object.entries(v).map(([ik, iv]) => [ik, iv ?? null])
      );
      return [k, inner];
    }
    return [k, v ?? null];
  });
  return Object.fromEntries(entries) as T;
}

//
// ✅ Page component
//
export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : (params?.id as string)), [params]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState<CustomerDoc>({
    name: "",
    phone: "",
    email: "",
    nationality: "",
    passportNo: "",
    address: "",
    dob: "",
    notes: "",
    family: [{ name: "", relation: "" }],
  });

  const canDelete = usePrivilege("customers.delete");
  const canUpdate = usePrivilege("customers.update");

  // 🔹 Load customer
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const ref = doc(db, "customers", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          toast.error("Customer not found");
          router.push("/sales/customers");
          return;
        }
        const data = snap.data() as CustomerDoc;
        setCustomer({
          name: data.name ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          nationality: data.nationality ?? "",
          passportNo: data.passportNo ?? "",
          address: data.address ?? "",
          dob: toDateInputValue(data.dob),
          notes: data.notes ?? "",
          family: Array.isArray(data.family) && data.family.length > 0
            ? data.family.map((m) => ({
                name: m.name ?? "",
                relation: m.relation ?? "",
                dob: toDateInputValue(m.dob),
                passportNo: m.passportNo ?? "",
                notes: m.notes ?? "",
              }))
            : [{ name: "", relation: "" }],
        });
      } catch (e) {
        console.error(e);
        toast.error("Failed to load customer");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  const setField = (key: keyof CustomerDoc, val: any) => {
    setCustomer((prev) => ({ ...prev, [key]: val }));
  };

  const addFamilyMember = () => {
    setCustomer((prev) => ({
      ...prev,
      family: [...(prev.family ?? []), { name: "", relation: "" }],
    }));
  };

  const removeFamilyMember = (index: number) => {
    setCustomer((prev) => ({
      ...prev,
      family: (prev.family ?? []).filter((_, i) => i !== index),
    }));
  };

  const updateFamilyMember = (index: number, key: keyof FamilyMember, val: string) => {
    setCustomer((prev) => {
      const fam = [...(prev.family ?? [])];
      const item = { ...(fam[index] ?? { name: "", relation: "" }) };
      (item as any)[key] = val;
      fam[index] = item;
      return { ...prev, family: fam };
    });
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdate) {
      toast.error("You don't have permission to update customers.");
      return;
    }
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error("Please fill in at least Name and Phone.");
      return;
    }

    const familyClean = (customer.family ?? [])
      .map((m) => ({
        name: m.name?.trim() || null,
        relation: m.relation?.trim() || null,
        dob: isoOrNullFromDateInput(m.dob),
        passportNo: m.passportNo?.trim() || null,
        notes: m.notes?.trim() || null,
      }))
      .filter((m) => m.name && m.relation);

   const payload: CustomerDoc = {
  name: customer.name.trim(),
  phone: customer.phone.trim(),
  email: customer.email?.trim() || null,
  nationality: customer.nationality?.trim() || null,
  passportNo: customer.passportNo?.trim() || null,
  address: customer.address?.trim() || null,
  dob: isoOrNullFromDateInput(customer.dob),
  notes: customer.notes?.trim() || null,
  family: familyClean,
  updatedAt: serverTimestamp(),
  updatedBy: auth.currentUser?.uid || null,
};

    try {
      setSaving(true);
      const ref = doc(db, "customers", id);
      await updateDoc(ref, sanitize(payload));
      toast.success("Customer updated successfully!");
      router.push(`/sales/customers/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update customer.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!canDelete) {
      toast.error("You don't have permission to delete customers.");
      return;
    }
    const ok = window.confirm("Are you sure you want to delete this customer?");
    if (!ok) return;
    try {
      const ref = doc(db, "customers", id);
      await deleteDoc(ref);
      toast.success("Customer deleted successfully!");
      router.push("/sales/customers");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete customer.");
    }
  };

  // if (loading) {
  //   return (
  //     <ProtectedRouteWithPrivilege requiredPrivilege="customers.update">
  //       <div className="p-6 text-center text-muted-foreground">Loading...</div>
  //     </ProtectedRouteWithPrivilege>
  //   );
  // }

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="customers.update">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4">
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
                    <BreadcrumbLink href="/sales">Sales</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={`/sales/customers/${id}`}>Customer</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Edit</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push(`/sales/customers/${id}`)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <ThemeToggle />
            </div>
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="max-w-5xl shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Edit Customer</CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={onSave} className="space-y-8">
                  {/* CUSTOMER INFO */}
                  <section>
                    <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="my-2">Full Name</Label>
                        <Input
                          value={customer.name}
                          onChange={(e) => setField("name", e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label className="my-2">Phone</Label>
                        <Input
                          value={customer.phone}
                          onChange={(e) => setField("phone", e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label className="my-2">Email</Label>
                        <Input
                          type="email"
                          value={customer.email ?? ""}
                          onChange={(e) => setField("email", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="my-2">Nationality</Label>
                        <Input
                          value={customer.nationality ?? ""}
                          onChange={(e) => setField("nationality", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="my-2">Passport No.</Label>
                        <Input
                          value={customer.passportNo ?? ""}
                          onChange={(e) => setField("passportNo", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="my-2">Date of Birth</Label>
                        <Input
                          type="date"
                          value={customer.dob ?? ""}
                          onChange={(e) => setField("dob", e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="my-2">Address</Label>
                        <Input
                          value={customer.address ?? ""}
                          onChange={(e) => setField("address", e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="my-2">Notes</Label>
                        <Textarea
                          rows={3}
                          value={customer.notes ?? ""}
                          onChange={(e) => setField("notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* FAMILY MEMBERS */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold">Family Members</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                        <Plus className="w-4 h-4 mr-1" /> Add Member
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {(customer.family ?? []).map((m, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border p-3 rounded-lg bg-muted/30"
                        >
                          <div className="sm:col-span-2">
                            <Label className="my-2">Name</Label>
                            <Input
                              value={m.name ?? ""}
                              onChange={(e) => updateFamilyMember(idx, "name", e.target.value)}
                              placeholder="e.g. Lana"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="my-2">Relation</Label>
                            <select
                              className="border rounded-md w-full h-10 px-3 bg-background"
                              value={m.relation ?? ""}
                              onChange={(e) => updateFamilyMember(idx, "relation", e.target.value)}
                            >
                              <option value="">Select</option>
                              <option value="Wife">Wife</option>
                              <option value="Husband">Husband</option>
                              <option value="Son">Son</option>
                              <option value="Daughter">Daughter</option>
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="my-2">Date of Birth</Label>
                            <Input
                              type="date"
                              value={m.dob ?? ""}
                              onChange={(e) => updateFamilyMember(idx, "dob", e.target.value)}
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <Label className="my-2">Passport No.</Label>
                            <Input
                              value={m.passportNo ?? ""}
                              onChange={(e) => updateFamilyMember(idx, "passportNo", e.target.value)}
                              placeholder="optional"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <Label className="my-2">Notes</Label>
                            <Input
                              value={m.notes ?? ""}
                              onChange={(e) => updateFamilyMember(idx, "notes", e.target.value)}
                              placeholder="optional"
                            />
                          </div>

                          {(customer.family ?? []).length > 1 && (
                            <div className="sm:col-span-6 flex justify-end">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeFamilyMember(idx)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ACTIONS */}
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {canDelete && (
                        <Button type="button" variant="destructive" onClick={onDelete}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete Customer
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push(`/sales/customers/${id}`)}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}