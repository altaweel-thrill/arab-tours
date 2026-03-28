"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { format, differenceInYears } from "date-fns";
import { Timeline, TimelineEvent } from "@/components/timeline/timeline";

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
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingProgress } from "@/components/loading-progrss";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { toast } from "sonner";
import { Edit, ArrowLeft } from "lucide-react";
import NotificationsBell from "@/components/notifications/NotificationsBell";

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<any>(null);
  const [createdByName, setCreatedByName] = useState<string>("-");
  const [updatedByName, setUpdatedByName] = useState<string>("-");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  /* ================= Get Current User ================= */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  /* ================= Fetch Customer ================= */
  useEffect(() => {
    if (!id) return;

    const fetchCustomer = async () => {
      try {
        const ref = doc(db, "customers", id as string);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          toast.error("Customer not found");
          router.push("/sales/customers");
          return;
        }

        const data = snap.data();
        setCustomer(data);

        // 🔹 Fetch creator name
        if (data.createdBy) {
          fetchUserName(data.createdBy).then(setCreatedByName);
        }

        // 🔹 Fetch updater name
        if (data.updatedBy) {
          fetchUserName(data.updatedBy).then(setUpdatedByName);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch customer");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id, router]);

  /* ================= Helpers ================= */

  const fetchUserName = async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        return userSnap.data()?.name || uid;
      }
      return uid;
    } catch {
      return uid;
    }
  };

  const getAge = (dob?: string) => {
    if (!dob) return "-";
    try {
      return differenceInYears(new Date(), new Date(dob)) + " yrs";
    } catch {
      return "-";
    }
  };

  if (loading) return <LoadingProgress />;

  if (!customer)
    return (
      <div className="p-6 text-center text-muted-foreground">
        No customer data found.
      </div>
    );

  /* ================= Timeline ================= */

  const timelineEvents: TimelineEvent[] = [
    {
      title: "Customer Created",
      user: createdByName,
      date: customer.createdAt?.seconds
        ? new Date(customer.createdAt.seconds * 1000)
        : null,
      color: "bg-emerald-500",
    },
  ];

  if (customer.updatedAt) {
    timelineEvents.push({
      title: "Customer Updated",
      user: updatedByName || "-",
      date: customer.updatedAt?.seconds
        ? new Date(customer.updatedAt.seconds * 1000)
        : null,
      color: "bg-blue-500",
    });
  }

  /* ================= Render ================= */

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="customers.view">
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
                    <BreadcrumbPage>Customer Details</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
             <Button
  size="sm"
  className="bg-emerald-600 hover:bg-emerald-700 text-white"
  onClick={() => router.push(`/sales/customers/${id}/add-sale`)}
>
  + Add Sales
</Button>

              <Button
                size="sm"
                onClick={() =>
                  router.push(`/sales/customers/${id}/edit`)
                }
              >
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            <NotificationsBell userId={user?.uid ?? " " } />
              

              <ThemeToggle />
            </div>
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen space-y-6">
            {/* CUSTOMER INFO */}
            <Card className="shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>

              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Info label="Full Name" value={customer.name} />
                <Info label="Phone" value={customer.phone} />
                <Info label="Email" value={customer.email} />
                <Info label="Nationality" value={customer.nationality} />
                <Info label="Passport No." value={customer.passportNo} />

                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {customer.dob
                      ? format(new Date(customer.dob), "yyyy-MM-dd")
                      : "-"}{" "}
                    ({getAge(customer.dob)})
                  </p>
                </div>

                <Info
                  className="sm:col-span-2 lg:col-span-3"
                  label="Address"
                  value={customer.address}
                />

                <Info
                  className="sm:col-span-2 lg:col-span-3"
                  label="Notes"
                  value={customer.notes}
                />

                <Info
                  label="Created At"
                  value={
                    customer.createdAt?.seconds
                      ? format(
                          new Date(customer.createdAt.seconds * 1000),
                          "yyyy-MM-dd HH:mm"
                        )
                      : "-"
                  }
                />

                <Info label="Created By" value={createdByName} />
              </CardContent>
            </Card>

            {/* FAMILY MEMBERS */}
            <Card className="shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Family Members</CardTitle>
              </CardHeader>
              <CardContent>
                {!customer.family || customer.family.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No family members added.
                  </p>
                ) : (
                  customer.family.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-3 border-b last:border-0"
                    >
                      <Info label="Name" value={m.name} />
                      <Info label="Relation" value={m.relation} />

                      <div>
                        <p className="text-sm text-muted-foreground">
                          Date of Birth
                        </p>
                        <p className="font-medium">
                          {m.dob
                            ? format(new Date(m.dob), "yyyy-MM-dd")
                            : "-"}{" "}
                          ({getAge(m.dob)})
                        </p>
                      </div>

                      <Info label="Passport No." value={m.passportNo} />
                      <Info label="Notes" value={m.notes} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* TIMELINE */}
            <Card className="shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={timelineEvents} />
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

/* ================= Info Row ================= */
function Info({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}