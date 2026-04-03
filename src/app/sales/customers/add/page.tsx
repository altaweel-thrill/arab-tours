"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

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
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/notifications/NotificationsBell";

type FamilyMember = {
  name: string;
  relation: string;
  dob?: string;
  passportNo?: string;
  notes?: string;
};

export default function AddCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();

const [customer, setCustomer] = useState({
  name: "",
  phone: "",
  email: "",
  nationality: "",
  passportNo: "",
  address: "",
  dob: "",
  notes: "",
  customerType: "",
});

const CUSTOMER_TYPES = [
  "Not Interested",
  "Regular",
  "Important",
  "VIP",
  "Complaint",
];

const NATIONALITIES = [
  "Saudi",
  "Egyptian",
  "Jordanian",
  "Palestinian",
  "Syrian",
  "Lebanese",
  "Iraqi",
  "Kuwaiti",
  "Qatari",
  "Bahraini",
  "Omani",
  "Emirati",
  "Yemeni",
  "Sudanese",
  "Moroccan",
  "Tunisian",
  "Algerian",
  "Libyan",
  "Turkish",
  "Indian",
  "Pakistani",
  "Bangladeshi",
  "Filipino",
  "Indonesian",
  "Nepali",
  "Sri Lankan",
  "British",
  "American",
  "Canadian",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Other",
];

  const [family, setFamily] = useState<FamilyMember[]>([
    { name: "", relation: "" },
  ]);

  const [saving, setSaving] = useState(false);

  const handleCustomerChange = (key: string, val: string) => {
    setCustomer((prev) => ({ ...prev, [key]: val }));
  };

  const addFamilyMember = () => {
    setFamily((prev) => [...prev, { name: "", relation: "" }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamily((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFamilyMember = (index: number, key: keyof FamilyMember, val: string) => {
    setFamily((prev) => {
      const copy = [...prev];
      (copy[index] as any)[key] = val;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!customer.name.trim() || !customer.phone.trim()) {
    toast.error("Please fill in at least Name and Phone.");
    return;
  }

  // تنظيف أفراد الأسرة
  const cleanedFamily = family
    .map((m) => ({
      name: m.name?.trim() || null,
      relation: m.relation?.trim() || null,
      dob: m.dob ? new Date(m.dob).toISOString() : null,
      passportNo: m.passportNo?.trim() || null,
      notes: m.notes?.trim() || null,
    }))
    .filter((m) => m.name && m.relation);

  // تنظيف بيانات العميل وتحويل undefined إلى null
  const cleanedCustomer = Object.fromEntries(
    Object.entries({
      ...customer,
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      customerType: customer.customerType.trim() || null,
      email: customer.email.trim() || null,
      nationality: customer.nationality.trim() || null,
      passportNo: customer.passportNo.trim() || null,
      address: customer.address.trim() || null,
      dob: customer.dob ? new Date(customer.dob).toISOString() : null,
      notes: customer.notes.trim() || null,
      family: cleanedFamily,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    }).map(([key, value]) => [key, value ?? null]) // 👈 هنا نضمن عدم وجود undefined
  );

  try {
    setSaving(true);
    await addDoc(collection(db, "customers"), cleanedCustomer);
    toast.success("Customer added successfully!");
    router.push("/sales/customers");
  } catch (err) {
    console.error(err);
    toast.error("Failed to add customer.");
  } finally {
    setSaving(false);
  }
};

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="customers.add">
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
                  <BreadcrumbItem>
                    <BreadcrumbPage>Add Customer</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
           <div className="ml-auto flex items-center gap-2">
                                  <NotificationsBell userId={user?.uid ?? " " } />
                                  <ThemeToggle />
                                </div>
                     </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="max-w-5xl shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Add New Customer</CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* CUSTOMER INFO */}
                  <section>
                    <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="my-2">Full Name</Label>
                        <Input
                          placeholder="e.g. Ahmed Al-Taweel"
                          value={customer.name}
                          onChange={(e) => handleCustomerChange("name", e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label className="my-2">Phone</Label>
                        <Input
                          placeholder="+9665xxxxxxxx"
                          value={customer.phone}
                          onChange={(e) => handleCustomerChange("phone", e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <Label className="my-2">Email</Label>
                        <Input
                          type="email"
                          placeholder="optional"
                          value={customer.email}
                          onChange={(e) => handleCustomerChange("email", e.target.value)}
                        />
                      </div>

                      <div>
  <Label className="my-2">Nationality</Label>
  <select
    className="w-full border rounded-md h-10 px-3 bg-background"
    value={customer.nationality}
    onChange={(e) => handleCustomerChange("nationality", e.target.value)}
  >
    <option value="">Select nationality</option>
    {NATIONALITIES.map((nationality) => (
      <option key={nationality} value={nationality}>
        {nationality}
      </option>
    ))}
  </select>
</div>




                      <div>
                        <Label className="my-2">Passport No.</Label>
                        <Input
                          placeholder="e.g. P1234567"
                          value={customer.passportNo}
                          onChange={(e) => handleCustomerChange("passportNo", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="my-2">Date of Birth</Label>
                        <Input
                          type="date"
                          value={customer.dob}
                          onChange={(e) => handleCustomerChange("dob", e.target.value)}
                        />
                      </div>
<div className="space-y-1">
  <Label>Customer Type</Label>

  <select
    className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
    value={customer.customerType || ""}
    onChange={(e) =>
      handleCustomerChange("customerType", e.target.value)
    }
  >
    <option value="">Select customer type</option>

    {CUSTOMER_TYPES.map((type) => (
      <option key={type} value={type}>
        {type}
      </option>
    ))}
  </select>
</div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="my-2">Address</Label>
                        <Input
                          placeholder="Street, City, Country"
                          value={customer.address}
                          onChange={(e) => handleCustomerChange("address", e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="my-2">Notes</Label>
                        <Textarea
                          rows={3}
                          placeholder="Any additional notes..."
                          value={customer.notes}
                          onChange={(e) => handleCustomerChange("notes", e.target.value)}
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
                      {family.map((m, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border p-3 rounded-lg bg-muted/30"
                        >
                          <div className="sm:col-span-2">
                            <Label className="my-2">Name</Label>
                            <Input
                              value={m.name}
                              onChange={(e) => updateFamilyMember(idx, "name", e.target.value)}
                              placeholder="e.g. Lana"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="my-2">Relation</Label>
                            <select
                              className="border rounded-md w-full h-10 px-3 bg-background"
                              value={m.relation}
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

                          {family.length > 1 && (
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
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/sales/customers")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Customer"}
                    </Button>
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