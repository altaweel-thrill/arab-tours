"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { Plus, Trash } from "lucide-react";

export default function AddSalesOrderPage() {
  const router = useRouter();

  // 🔹 بيانات العميل
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    country: "",
  });

  // 🔹 بيانات الطلب
  const [order, setOrder] = useState({
    status: "pending",
  });

  // 🔹 الخدمات داخل الطلب
  const [services, setServices] = useState([
    {
      type: "flight",
      description: "",
      cost: "",
      salePrice: "",
    },
  ]);

  const [loading, setLoading] = useState(false);

  // ✅ إضافة خدمة جديدة
  const addService = () => {
    setServices((prev) => [
      ...prev,
      { type: "flight", description: "", cost: "", salePrice: "" },
    ]);
  };

  // ✅ حذف خدمة
  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ تغيير بيانات خدمة معينة
  const handleServiceChange = (
    index: number,
    field: string,
    value: string
  ) => {
    const updated = [...services];
    (updated[index] as any)[field] = value;
    setServices(updated);
  };

  // ✅ حساب الإجماليات
  const totals = services.reduce(
    (acc, s) => {
      const cost = parseFloat(s.cost) || 0;
      const price = parseFloat(s.salePrice) || 0;
      acc.totalCost += cost;
      acc.totalPrice += price;
      return acc;
    },
    { totalCost: 0, totalPrice: 0 }
  );
  const profit = totals.totalPrice - totals.totalCost;

  // ✅ حفظ الطلب
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1️⃣ إنشاء العميل
      const customerRef = await addDoc(collection(db, "customers"), {
        ...customer,
        createdAt: serverTimestamp(),
      });

      // 2️⃣ إنشاء الطلب
      const orderRef = await addDoc(collection(db, "salesOrders"), {
        customerId: customerRef.id,
        status: order.status,
        totalCost: totals.totalCost,
        totalPrice: totals.totalPrice,
        totalProfit: profit,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3️⃣ إضافة الخدمات كـ Subcollection
      for (const s of services) {
        await addDoc(collection(db, `salesOrders/${orderRef.id}/services`), {
          ...s,
          cost: parseFloat(s.cost) || 0,
          salePrice: parseFloat(s.salePrice) || 0,
          profit: (parseFloat(s.salePrice) || 0) - (parseFloat(s.cost) || 0),
          status: "waiting",
        });
      }

      toast.success("Order added successfully!");
      router.push("/sales");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.add">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4">
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
                    <BreadcrumbPage>Add Order</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <ThemeToggle />
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="max-w-5xl ">
              <CardHeader>
                <CardTitle>Add New Sales Order</CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* 🧍 Customer Info */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <Label className="my-2">Name</Label>
                        <Input
                          name="name"
                          value={customer.name}
                          onChange={(e) =>
                            setCustomer({ ...customer, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="my-2">Phone</Label>
                        <Input
                          name="phone"
                          value={customer.phone}
                          onChange={(e) =>
                            setCustomer({ ...customer, phone: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label className="my-2">Email</Label>
                        <Input
                          type="email"
                          name="email"
                          value={customer.email}
                          onChange={(e) =>
                            setCustomer({ ...customer, email: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <Label className="my-2">Country</Label>
                        <Input
                          name="country"
                          value={customer.country}
                          onChange={(e) =>
                            setCustomer({ ...customer, country: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* 🧾 Services */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Services</h3>
                      <Button type="button" onClick={addService} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Add Service
                      </Button>
                    </div>

                    {services.map((s, i) => (
                      <div
                        key={i}
                        className="grid gap-3 sm:grid-cols-5 items-end border p-3 rounded-lg mb-3 bg-muted/30"
                      >
                        <div>
                          <Label className="my-2">Type</Label>
                          <select
                            value={s.type}
                            onChange={(e) =>
                              handleServiceChange(i, "type", e.target.value)
                            }
                            className="border rounded-md w-full h-10 px-3 bg-background"
                          >
                            <option value="flight">Flight</option>
                            <option value="visa">Visa</option>
                            <option value="hotel">Hotel</option>
                            <option value="car">Car</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="my-2">Description</Label>
                          <Input
                            value={s.description}
                            onChange={(e) =>
                              handleServiceChange(i, "description", e.target.value)
                            }
                            placeholder="Details of the service..."
                          />
                        </div>

                        <div>
                          <Label className="my-2">Cost (SAR)</Label>
                          <Input
                            type="number"
                            value={s.cost}
                            onChange={(e) =>
                              handleServiceChange(i, "cost", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label className="my-2">Sale Price (SAR)</Label>
                          <Input
                            type="number"
                            value={s.salePrice}
                            onChange={(e) =>
                              handleServiceChange(i, "salePrice", e.target.value)
                            }
                          />
                        </div>

                        {services.length > 1 && (
                          <div className="flex justify-end sm:col-span-5">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => removeService(i)}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* 💰 Totals */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="my-2">Total Cost</Label>
                      <Input value={totals.totalCost.toFixed(2)} readOnly />
                    </div>
                    <div>
                      <Label className="my-2">Total Price</Label>
                      <Input value={totals.totalPrice.toFixed(2)} readOnly />
                    </div>
                    <div>
                      <Label className="my-2">Profit</Label>
                      <Input value={profit.toFixed(2)} readOnly />
                    </div>
                  </div>

                  <Separator />

                  {/* Buttons */}
                  <div className="flex justify-end gap-3">
                    <Button asChild variant="outline">
                      <Link href="/sales">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save Order"}
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