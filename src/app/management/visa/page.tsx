"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { ThemeToggle } from "@/components/theme-toggle";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

/* ---------------- Types ---------------- */

type Visa = {
  id: string;
  countryName: string;
  countryCode?: string;
  flag: string;
  visaType: string;
  visaCategory: string;
  priceFrom: number;
  durationDays?: number | null; // ✅ NEW (optional)
  isActive: boolean;
};

type CountryOption = {
  code: string;
  name: string;
  flag: string;
};

/* ---------------- Static Data ---------------- */

const COUNTRIES: CountryOption[] = [
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },

  // Existing
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
];

const VISA_TYPES = ["Tourist", "Visit", "Business", "Medical", "Student"];

const VISA_CATEGORIES = [
  "Single Entry",
  "Multiple Entry",
  "Schengen",
  "Short Term",
  "Long Term",
];

/* ---------------- Page ---------------- */

export default function VisaManagementPage() {
  const { user } = useAuth();

  const [visas, setVisas] = useState<Visa[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVisa, setEditingVisa] = useState<Visa | null>(null);

  const [countryCode, setCountryCode] = useState("");
  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode),
    [countryCode]
  );

  const [visaType, setVisaType] = useState("");
  const [visaCategory, setVisaCategory] = useState("");
  const [priceFrom, setPriceFrom] = useState("");

  // ✅ NEW: duration days (optional)
  const [durationDays, setDurationDays] = useState<string>("");

  useEffect(() => {
    fetchVisas();
  }, []);

  const fetchVisas = async () => {
    const snap = await getDocs(collection(db, "visaCatalog"));
    setVisas(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Visa[]
    );
  };

  const toggleActive = async (id: string, val: boolean) => {
    await updateDoc(doc(db, "visaCatalog", id), { isActive: val });
    fetchVisas();
  };

  const resetForm = () => {
    setCountryCode("");
    setVisaType("");
    setVisaCategory("");
    setPriceFrom("");
    setDurationDays(""); // ✅ reset
    setEditingVisa(null);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (v: Visa) => {
    setEditingVisa(v);
    setCountryCode(v.countryCode || "");
    setVisaType(v.visaType);
    setVisaCategory(v.visaCategory);
    setPriceFrom(String(v.priceFrom ?? 0));
    setDurationDays(
      typeof v.durationDays === "number" ? String(v.durationDays) : ""
    ); // ✅ set value if exists
    setOpen(true);
  };

  const parseOptionalIntOrNull = (val: string) => {
    const s = val.trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    const intN = Math.floor(n);
    if (intN <= 0) return null;
    return intN;
  };

  const saveVisa = async () => {
    if (!country || !visaType || !visaCategory) return;

    const durationValue = parseOptionalIntOrNull(durationDays);

    try {
      setSaving(true);

      if (editingVisa) {
        // ✏️ UPDATE
        await updateDoc(doc(db, "visaCatalog", editingVisa.id), {
          countryName: country.name,
          countryCode: country.code,
          flag: country.flag,
          visaType,
          visaCategory,
          priceFrom: Number(priceFrom || 0),
          durationDays: durationValue, // ✅ NEW
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || null,
        });
      } else {
        // ➕ CREATE
        await addDoc(collection(db, "visaCatalog"), {
          countryName: country.name,
          countryCode: country.code,
          flag: country.flag,
          visaType,
          visaCategory,
          priceFrom: Number(priceFrom || 0),
          durationDays: durationValue, // ✅ NEW
          currency: "SAR",
          isActive: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        });
      }

      setOpen(false);
      resetForm();
      fetchVisas();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="visa.manage">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 items-center justify-between border-b bg-background/50 px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/management">Management</BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="p-6 max-w-6xl space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold">Visa Management</h1>
              <Button onClick={openAdd}>Add Visa</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Available Visas</CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">
                {visas.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between border rounded p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {v.flag} {v.countryName} – {v.visaType}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {v.visaCategory} | From {v.priceFrom} SAR
                        {typeof v.durationDays === "number" && v.durationDays > 0
                          ? ` | ${v.durationDays} days`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={v.isActive}
                        onCheckedChange={(val) => toggleActive(v.id, val)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(v)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* -------- ADD / EDIT POPUP -------- */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingVisa ? "Edit Visa" : "Add Visa"}
                </DialogTitle>
              </DialogHeader>

              <Card>
                <CardContent className="space-y-3 pt-4">
                  <div>
                    <Label className="my-2">Country</Label>
                    <select
                      className="w-full border rounded h-10 px-3 bg-background"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="my-2">Visa Type</Label>
                    <select
                      className="w-full border rounded h-10 px-3 bg-background"
                      value={visaType}
                      onChange={(e) => setVisaType(e.target.value)}
                    >
                      <option value="">Select type</option>
                      {VISA_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="my-2">Visa Category</Label>
                    <select
                      className="w-full border rounded h-10 px-3 bg-background"
                      value={visaCategory}
                      onChange={(e) => setVisaCategory(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {VISA_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="my-2">Price From (SAR)</Label>
                    <Input
                      type="number"
                      value={priceFrom}
                      onChange={(e) => setPriceFrom(e.target.value)}
                    />
                  </div>

                  {/* ✅ NEW: Duration days (optional) */}
                  <div>
                    <Label className="my-2">
                      Duration (Days) <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 30"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>

                    <Button
                      onClick={saveVisa}
                      disabled={!country || !visaType || !visaCategory || saving}
                    >
                      {editingVisa ? "Update" : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}