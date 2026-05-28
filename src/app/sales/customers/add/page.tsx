"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { format } from "date-fns";
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
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/notifications/NotificationsBell";

type FamilyMember = {
  name: string;
  relation: string;
  dob?: string;
  passportNo?: string;
  notes?: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  nationality: string;
  passportNo: string;
  address: string;
  dob: string;
  notes: string;
  customerType: string;
};

type ExistingCustomer = CustomerForm & {
  id: string;
  createdAt?: any;
  createdBy?: string | null;
  coRegisters?: string[];
};

type Step = "lookup" | "details" | "existing";

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

const emptyCustomer: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  nationality: "",
  passportNo: "",
  address: "",
  dob: "",
  notes: "",
  customerType: "",
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function formatFirebaseDate(value?: any) {
  try {
    if (value?.seconds) {
      return format(new Date(value.seconds * 1000), "yyyy-MM-dd HH:mm");
    }

    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return format(date, "yyyy-MM-dd HH:mm");
    }
  } catch {
    return "-";
  }

  return "-";
}

export default function AddCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("lookup");
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [family, setFamily] = useState<FamilyMember[]>([
    { name: "", relation: "" },
  ]);

  const [existingCustomer, setExistingCustomer] =
    useState<ExistingCustomer | null>(null);
  const [registeredByName, setRegisteredByName] = useState("-");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCustomerChange = (key: keyof CustomerForm, val: string) => {
    setCustomer((prev) => ({ ...prev, [key]: val }));
  };

  const addFamilyMember = () => {
    setFamily((prev) => [...prev, { name: "", relation: "" }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamily((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFamilyMember = (
    index: number,
    key: keyof FamilyMember,
    val: string
  ) => {
    setFamily((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const fetchUserName = async (uid?: string | null) => {
    if (!uid) return "-";

    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) return uid;

      const data = userSnap.data();
      return data.name || data.email || uid;
    } catch {
      return uid;
    }
  };

  const findExistingCustomer = async (phone: string) => {
    const customersRef = collection(db, "customers");
    const trimmedPhone = phone.trim();
    const normalizedPhone = normalizePhone(trimmedPhone);

    const searches = [];

    if (normalizedPhone) {
      searches.push(
        query(
          customersRef,
          where("phoneNormalized", "==", normalizedPhone),
          limit(1)
        )
      );
    }

    searches.push(
      query(customersRef, where("phone", "==", trimmedPhone), limit(1))
    );

    for (const searchQuery of searches) {
      const snap = await getDocs(searchQuery);
      const first = snap.docs[0];
      if (first) {
        return {
          id: first.id,
          ...first.data(),
        } as ExistingCustomer;
      }
    }

    if (!normalizedPhone) return null;

    const allSnap = await getDocs(customersRef);
    const matched = allSnap.docs.find((customerDoc) => {
      const data = customerDoc.data();
      return normalizePhone(String(data.phone || "")) === normalizedPhone;
    });

    if (!matched) return null;

    return {
      id: matched.id,
      ...matched.data(),
    } as ExistingCustomer;
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = customer.name.trim();
    const phone = customer.phone.trim();

    if (!name || !phone) {
      toast.error("Please enter customer name and phone.");
      return;
    }

    try {
      setChecking(true);
      const existing = await findExistingCustomer(phone);

      setCustomer((prev) => ({
        ...prev,
        name,
        phone,
      }));

      if (existing) {
        setExistingCustomer(existing);
        setRegisteredByName(await fetchUserName(existing.createdBy));
        setStep("existing");
        return;
      }

      setExistingCustomer(null);
      setRegisteredByName("-");
      setStep("details");
    } catch (err) {
      console.error(err);
      toast.error("Failed to check customer.");
    } finally {
      setChecking(false);
    }
  };

  const buildCustomerPayload = () => {
    const cleanedFamily = family
      .map((member) => ({
        name: member.name?.trim() || null,
        relation: member.relation?.trim() || null,
        dob: member.dob ? new Date(member.dob).toISOString() : null,
        passportNo: member.passportNo?.trim() || null,
        notes: member.notes?.trim() || null,
      }))
      .filter((member) => member.name && member.relation);

    return Object.fromEntries(
      Object.entries({
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        phoneNormalized: normalizePhone(customer.phone),
        customerType: customer.customerType.trim() || null,
        email: customer.email.trim() || null,
        nationality: customer.nationality.trim() || null,
        passportNo: customer.passportNo.trim() || null,
        address: customer.address.trim() || null,
        dob: customer.dob ? new Date(customer.dob).toISOString() : null,
        notes: customer.notes.trim() || null,
        family: cleanedFamily,
        coRegisters: user?.uid ? [user.uid] : [],
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      }).map(([key, value]) => [key, value ?? null])
    );
  };

  const saveNewCustomer = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error("Please enter customer name and phone.");
      setStep("lookup");
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "customers"), buildCustomerPayload());
      toast.success("Customer added successfully!");
      router.push("/sales/customers");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add customer.");
    } finally {
      setSaving(false);
    }
  };

  const continueWithExistingCustomer = async () => {
    if (!existingCustomer?.id) return;

    try {
      setSaving(true);

      if (user?.uid) {
        await updateDoc(doc(db, "customers", existingCustomer.id), {
          coRegisters: arrayUnion(user.uid),
          lastCoRegisteredBy: user.uid,
          lastCoRegisteredAt: serverTimestamp(),
        });
      }

      toast.success("Employee added to customer.");
      router.push(`/sales/customers/${existingCustomer.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to continue with this customer.");
    } finally {
      setSaving(false);
    }
  };

  const resetLookup = () => {
    setStep("lookup");
    setExistingCustomer(null);
    setRegisteredByName("-");
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="customers.add">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
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
              <NotificationsBell userId={user?.uid ?? " "} />
              <ThemeToggle />
            </div>
          </header>

          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="max-w-5xl shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Add New Customer</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="py-2">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <CustomerStep
                      number={1}
                      title="Customer Check"
                      isActive={step === "lookup"}
                      isComplete={step !== "lookup"}
                    />

                    <div className="hidden h-px flex-1 bg-border sm:block">
                      <div
                        className={`h-px transition-all duration-300 ${
                          step === "lookup" ? "w-0 bg-primary" : "w-full bg-primary"
                        }`}
                      />
                    </div>

                    <CustomerStep
                      number={2}
                      title="Customer Status"
                      isActive={step !== "lookup"}
                    />
                  </div>
                </div>

                {step === "lookup" && (
                  <form onSubmit={handleLookup} className="space-y-5">
                    <section>
                      <h3 className="text-lg font-semibold mb-2">
                        Customer Check
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="my-2">Full Name</Label>
                          <Input
                            placeholder="e.g. Ahmed Al-Taweel"
                            value={customer.name}
                            onChange={(e) =>
                              handleCustomerChange("name", e.target.value)
                            }
                            required
                          />
                        </div>

                        <div>
                          <Label className="my-2">Phone</Label>
                          <Input
                            placeholder="+9665xxxxxxxx"
                            value={customer.phone}
                            onChange={(e) =>
                              handleCustomerChange("phone", e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/sales/customers")}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={checking}>
                        <Search className="w-4 h-4 mr-1" />
                        {checking ? "Checking..." : "Check Customer"}
                      </Button>
                    </div>
                  </form>
                )}

                {step === "existing" && existingCustomer && (
                  <div className="space-y-6">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold">
                              Customer is already registered
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              You can continue and this employee will be added
                              as a co-register for this customer.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <Info label="Customer" value={existingCustomer.name} />
                            <Info label="Phone" value={existingCustomer.phone} />
                            <Info label="Registered By" value={registeredByName} />
                            <Info
                              label="Registered At"
                              value={formatFirebaseDate(existingCustomer.createdAt)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={resetLookup}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={continueWithExistingCustomer}
                        disabled={saving}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        {saving ? "Saving..." : "Continue"}
                      </Button>
                    </div>
                  </div>
                )}

                {step === "details" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveNewCustomer();
                    }}
                    className="space-y-8"
                  >
                    <section>
                      <div className="flex flex-col gap-1 mb-4">
                        <h3 className="text-lg font-semibold">
                          Customer Information
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {customer.name} | {customer.phone}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label className="my-2">Email</Label>
                          <Input
                            type="email"
                            placeholder="optional"
                            value={customer.email}
                            onChange={(e) =>
                              handleCustomerChange("email", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Nationality</Label>
                          <select
                            className="w-full border rounded-md h-10 px-3 bg-background"
                            value={customer.nationality}
                            onChange={(e) =>
                              handleCustomerChange("nationality", e.target.value)
                            }
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
                            onChange={(e) =>
                              handleCustomerChange("passportNo", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Date of Birth</Label>
                          <Input
                            type="date"
                            value={customer.dob}
                            onChange={(e) =>
                              handleCustomerChange("dob", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Customer Type</Label>
                          <select
                            className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={customer.customerType}
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
                            onChange={(e) =>
                              handleCustomerChange("address", e.target.value)
                            }
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                          <Label className="my-2">Notes</Label>
                          <Textarea
                            rows={3}
                            placeholder="Any additional notes..."
                            value={customer.notes}
                            onChange={(e) =>
                              handleCustomerChange("notes", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold">Family Members</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addFamilyMember}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Member
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {family.map((member, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border p-3 rounded-lg bg-muted/30"
                          >
                            <div className="sm:col-span-2">
                              <Label className="my-2">Name</Label>
                              <Input
                                value={member.name}
                                onChange={(e) =>
                                  updateFamilyMember(
                                    index,
                                    "name",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Lana"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <Label className="my-2">Relation</Label>
                              <select
                                className="border rounded-md w-full h-10 px-3 bg-background"
                                value={member.relation}
                                onChange={(e) =>
                                  updateFamilyMember(
                                    index,
                                    "relation",
                                    e.target.value
                                  )
                                }
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
                                value={member.dob ?? ""}
                                onChange={(e) =>
                                  updateFamilyMember(index, "dob", e.target.value)
                                }
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <Label className="my-2">Passport No.</Label>
                              <Input
                                value={member.passportNo ?? ""}
                                onChange={(e) =>
                                  updateFamilyMember(
                                    index,
                                    "passportNo",
                                    e.target.value
                                  )
                                }
                                placeholder="optional"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <Label className="my-2">Notes</Label>
                              <Input
                                value={member.notes ?? ""}
                                onChange={(e) =>
                                  updateFamilyMember(
                                    index,
                                    "notes",
                                    e.target.value
                                  )
                                }
                                placeholder="optional"
                              />
                            </div>

                            {family.length > 1 && (
                              <div className="sm:col-span-6 flex justify-end">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => removeFamilyMember(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="flex justify-between gap-3">
                      <Button type="button" variant="outline" onClick={resetLookup}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={saveNewCustomer}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Later"}
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? "Saving..." : "Save Customer"}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

function CustomerStep({
  number,
  title,
  isActive = false,
  isComplete = false,
}: {
  number: number;
  title: string;
  isActive?: boolean;
  isComplete?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition-colors ${
        isActive ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
          isComplete
            ? "border-emerald-600 bg-emerald-600 text-white"
            : isActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {isComplete ? <CheckCircle2 className="h-5 w-5" /> : number}
      </div>

      <p className="min-w-0 text-sm font-medium leading-snug text-foreground">
        {title}
      </p>
    </div>
  );
}
