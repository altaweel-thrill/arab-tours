"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { LoadingProgress } from "@/components/loading-progrss";
import { usePrivilege } from "@/hooks/usePrivilege";

export default function SalesOrderDetailsPage() {
  const { id } = useParams();
  const canUpdate = usePrivilege("sales.update");

  const [order, setOrder] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        // 🧾 جلب الطلب
        const orderRef = doc(db, "salesOrders", id as string);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
          toast.error("Order not found");
          return;
        }

        const orderData = orderSnap.data();
        setOrder({ id: orderSnap.id, ...orderData });

        // 🧍 جلب العميل
        if (orderData.customerId) {
          const customerRef = doc(db, "customers", orderData.customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) setCustomer(customerSnap.data());
        }

        // 🧩 جلب الخدمات
        const servicesSnap = await getDocs(
          collection(db, `salesOrders/${id}/services`)
        );
        const servicesData = servicesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setServices(servicesData);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // ✅ تحديث سعر البيع أو الحالة
  const handleServiceUpdate = async (serviceId: string, updates: any) => {
    try {
      setSaving(true);
      const ref = doc(db, `salesOrders/${id}/services`, serviceId);
      await updateDoc(ref, updates);
      toast.success("Service updated");

      // تحديث الواجهة بعد الحفظ
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, ...updates } : s
        )
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to update service");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingProgress />;
  if (!order) return <div className="p-6 text-center">Order not found.</div>;

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

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="sales.view">
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
                    <BreadcrumbPage>Order Details</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <ThemeToggle />
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen space-y-8">
            {/* 🧍 Customer */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="font-medium">{customer?.name ?? "-"}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="font-medium">{customer?.phone ?? "-"}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{customer?.email ?? "-"}</p>
                </div>
                <div>
                  <Label>Country</Label>
                  <p className="font-medium">{customer?.country ?? "-"}</p>
                </div>
              </CardContent>
            </Card>

            {/* 🧾 Services */}
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {services.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    No services added to this order.
                  </p>
                )}

                {services.map((s) => (
                  <div
                    key={s.id}
                    className="grid sm:grid-cols-6 items-center border p-3 rounded-lg bg-muted/30 gap-3"
                  >
                    <div>
                      <Label>Type</Label>
                      <p className="capitalize">{s.type}</p>
                    </div>

                    <div className="sm:col-span-2">
                      <Label>Description</Label>
                      <p>{s.description}</p>
                    </div>

                    <div>
                      <Label>Cost (SAR)</Label>
                      <p>{s.cost}</p>
                    </div>

                    <div>
                      <Label>Sale Price (SAR)</Label>
                      {canUpdate ? (
                        <Input
                          defaultValue={s.salePrice}
                          type="number"
                          onBlur={(e) =>
                            handleServiceUpdate(s.id, {
                              salePrice: parseFloat(e.target.value),
                              profit:
                                parseFloat(e.target.value) - parseFloat(s.cost),
                            })
                          }
                        />
                      ) : (
                        <p>{s.salePrice}</p>
                      )}
                    </div>

                    <div>
                      <Label>Profit</Label>
                      <p className="font-semibold text-emerald-600">
                        {((parseFloat(s.salePrice) || 0) - (parseFloat(s.cost) || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 💰 Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Total Cost</Label>
                  <Input readOnly value={totals.totalCost.toFixed(2)} />
                </div>
                <div>
                  <Label>Total Price</Label>
                  <Input readOnly value={totals.totalPrice.toFixed(2)} />
                </div>
                <div>
                  <Label>Total Profit</Label>
                  <Input readOnly value={profit.toFixed(2)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}