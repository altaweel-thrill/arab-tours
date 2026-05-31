"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { differenceInYears, format } from "date-fns";
import {
  CalendarDays,
  Edit,
  Eye,
  Mail,
  Phone,
  Plus,
  ReceiptText,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { LoadingProgress } from "@/components/loading-progrss";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Timeline, TimelineEvent } from "@/components/timeline/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";

type CustomerDoc = {
  name?: string;
  phone?: string;
  email?: string | null;
  nationality?: string | null;
  passportNo?: string | null;
  address?: string | null;
  dob?: string | null;
  notes?: string | null;
  customerType?: string | null;
  family?: any[];
  createdAt?: any;
  createdBy?: string | null;
  updatedAt?: any;
  updatedBy?: string | null;
};

type SalesOrder = {
  id: string;
  orderNumber?: string;
  status?: string;
  totalCost?: number;
  totalPrice?: number;
  totalProfit?: number;
  paidAmount?: number;
  remainingAmount?: number;
  createdAt?: any;
};

function toDate(value: any) {
  if (!value) return null;
  if (value.seconds) return new Date(value.seconds * 1000);

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(value: any, pattern = "yyyy-MM-dd") {
  const date = toDate(value);
  return date ? format(date, pattern) : "-";
}

function getAge(dob?: string | null) {
  if (!dob) return "-";

  try {
    return `${differenceInYears(new Date(), new Date(dob))} yrs`;
  } catch {
    return "-";
  }
}

function statusVariant(status?: string) {
  if (status === "completed") return "bg-emerald-600 hover:bg-emerald-600";
  if (status === "approved") return "bg-blue-600 hover:bg-blue-600";
  if (status === "pending") return "bg-amber-600 hover:bg-amber-600";
  return "bg-muted text-muted-foreground hover:bg-muted";
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const customerId = Array.isArray(params?.id)
    ? params.id[0]
    : (params?.id as string);

  const [customer, setCustomer] = useState<CustomerDoc | null>(null);
  const [createdByName, setCreatedByName] = useState("-");
  const [updatedByName, setUpdatedByName] = useState("-");
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserName = async (uid?: string | null) => {
    if (!uid) return "-";

    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        return data?.name || data?.email || uid;
      }
      return uid;
    } catch {
      return uid;
    }
  };

  useEffect(() => {
    if (!customerId) return;

    const loadCustomer = async () => {
      try {
        setLoading(true);

        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
          toast.error("Customer not found");
          router.push("/sales/customers");
          return;
        }

        const customerData = customerSnap.data() as CustomerDoc;
        setCustomer(customerData);

        if (customerData.createdBy) {
          setCreatedByName(await fetchUserName(customerData.createdBy));
        }

        if (customerData.updatedBy) {
          setUpdatedByName(await fetchUserName(customerData.updatedBy));
        }

        const ordersSnap = await getDocs(
          query(
            collection(db, "salesOrders"),
            where("customerId", "==", customerId)
          )
        );

        const ordersData = ordersSnap.docs
          .map((orderDoc) => ({
            id: orderDoc.id,
            ...orderDoc.data(),
          }))
          .sort((a: any, b: any) => {
            const aTime = toDate(a.createdAt)?.getTime() ?? 0;
            const bTime = toDate(b.createdAt)?.getTime() ?? 0;
            return bTime - aTime;
          }) as SalesOrder[];

        setOrders(ordersData);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load customer details");
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [customerId, router]);

  const salesTotals = useMemo(() => {
    return orders.reduce(
      (acc, order) => ({
        revenue: acc.revenue + Number(order.totalPrice || 0),
        profit: acc.profit + Number(order.totalProfit || 0),
        paid: acc.paid + Number(order.paidAmount || 0),
        remaining: acc.remaining + Number(order.remainingAmount || 0),
      }),
      { revenue: 0, profit: 0, paid: 0, remaining: 0 }
    );
  }, [orders]);

  if (loading) return <LoadingProgress />;

  if (!customer) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No customer data found.
      </div>
    );
  }

  const timelineEvents: TimelineEvent[] = [
    {
      title: "Customer Created",
      user: createdByName,
      date: toDate(customer.createdAt),
      color: "bg-emerald-500",
    },
  ];

  if (customer.updatedAt) {
    timelineEvents.push({
      title: "Customer Updated",
      user: updatedByName,
      date: toDate(customer.updatedAt),
      color: "bg-blue-500",
    });
  }

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="customers.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm">
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
              <NotificationsBell userId={user?.uid ?? ""} />
              <ThemeToggle />
            </div>
          </header>

          <div className="min-h-screen space-y-6 bg-muted/10 p-6">
            <section className="rounded-xl border bg-background p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-2xl font-semibold">
                        {customer.name || "Unnamed Customer"}
                      </h1>
                      {customer.customerType && (
                        <Badge variant="secondary">{customer.customerType}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {customer.phone || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {customer.email || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        Registered {formatDate(customer.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() =>
                      router.push(`/sales/customers/${customerId}/add-sale`)
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Sales
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/sales/customers/${customerId}/edit`)
                    }
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard
                title="Sales Orders"
                value={orders.length.toString()}
                icon={<ReceiptText className="h-4 w-4" />}
              />
              <SummaryCard
                title="Revenue"
                value={formatCurrency(salesTotals.revenue)}
                icon={<WalletCards className="h-4 w-4" />}
              />
              <SummaryCard
                title="Profit"
                value={formatCurrency(salesTotals.profit)}
                icon={<TrendingUp className="h-4 w-4" />}
                accent="text-emerald-600"
              />
              <SummaryCard
                title="Remaining"
                value={formatCurrency(salesTotals.remaining)}
                icon={<CalendarDays className="h-4 w-4" />}
              />
            </section>

            <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Sales Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="font-medium">No sales operations yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create the first sales order for this customer.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() =>
                            router.push(`/sales/customers/${customerId}/add-sale`)
                          }
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add Sales
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order ID</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Profit</TableHead>
                              <TableHead>Paid</TableHead>
                              <TableHead>Remaining</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orders.map((order) => (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">
                                  {order.orderNumber || order.id}
                                </TableCell>
                                <TableCell>
                                  {formatDate(order.createdAt, "yyyy-MM-dd HH:mm")}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`capitalize ${statusVariant(
                                      order.status
                                    )}`}
                                  >
                                    {order.status || "pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(Number(order.totalPrice || 0))}
                                </TableCell>
                                <TableCell className="text-emerald-600">
                                  {formatCurrency(Number(order.totalProfit || 0))}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(Number(order.paidAmount || 0))}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(
                                    Number(order.remainingAmount || 0)
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() =>
                                      router.push(`/sales/orders/${order.id}`)
                                    }
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Family Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!customer.family || customer.family.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No family members added.
                      </p>
                    ) : (
                      <div className="divide-y rounded-lg border">
                        {customer.family.map((member: any, index: number) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-5"
                          >
                            <Info label="Name" value={member.name} />
                            <Info label="Relation" value={member.relation} />
                            <Info
                              label="Date of Birth"
                              value={
                                member.dob
                                  ? `${formatDate(member.dob)} (${getAge(
                                      member.dob
                                    )})`
                                  : "-"
                              }
                            />
                            <Info label="Passport No." value={member.passportNo} />
                            <Info label="Notes" value={member.notes} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

                <aside className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Info label="Full Name" value={customer.name} />
                    <Info label="Phone" value={customer.phone} />
                    <Info label="Email" value={customer.email || undefined} />
                    <Info label="Nationality" value={customer.nationality || undefined} />
                    <Info label="Passport No." value={customer.passportNo || undefined} />
                    <Info
                      label="Date of Birth"
                      value={
                        customer.dob
                          ? `${formatDate(customer.dob)} (${getAge(customer.dob)})`
                          : "-"
                      }
                    />
                    <Info label="Address" value={customer.address || undefined} />
                    <Info label="Notes" value={customer.notes || undefined} />
                    <Separator />
                    <Info
                      label="Created At"
                      value={formatDate(customer.createdAt, "yyyy-MM-dd HH:mm")}
                    />
                    <Info label="Created By" value={createdByName} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Timeline events={timelineEvents} />
                  </CardContent>
                </Card>
                </aside>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  accent = "",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`truncate text-xl font-semibold ${accent}`}>{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value || "-"}</p>
    </div>
  );
}
