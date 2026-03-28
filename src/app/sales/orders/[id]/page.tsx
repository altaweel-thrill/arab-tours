"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { ArrowLeft, CheckCircle, Clock } from "lucide-react";

/* ---------------- Types ---------------- */

type Order = {
  customerId: string;
  status: string;
  totalCost: number;
  totalPrice: number;
  totalProfit: number;
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

/* ---------------- Page ---------------- */

export default function SalesOrderDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

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
      } catch (e) {
        console.error(e);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const updateStatus = async (status: string) => {
    try {
      await updateDoc(doc(db, "salesOrders", id as string), { status });
      setOrder((prev) => (prev ? { ...prev, status } : prev));
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading || !order) return null;

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
              <CardContent className="grid grid-cols-3 gap-4 font-medium">
                <div>Total Cost: {order.totalCost} SAR</div>
                <div>Total Price: {order.totalPrice} SAR</div>
                <div className="text-emerald-600">
                  Profit: {order.totalProfit} SAR
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