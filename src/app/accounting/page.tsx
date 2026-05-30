"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Filter,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { useAuth } from "@/context/AuthContext";
import { usePrivilege } from "@/hooks/usePrivilege";

type AccountingEntry = {
  id: string;
  orderId: string;
  customerId: string;
  direction: "in" | "out";
  sourceType: "customer_payment" | "service_cost" | "payment_method_fee";
  amount: number;
  currency: "SAR";
  paymentMethodId?: string;
  paymentMethodName?: string;
  paymentMethodPercentageRate?: number;
  paymentMethodFixedFee?: number;
  paymentMethodFeeAmount?: number;
  description: string;
  file?: {
    name: string;
    url: string;
    path: string;
  } | null;
  status: "pending" | "confirmed";
  createdBy?: string | null;
  createdAt?: any;
  confirmedBy?: string | null;
  confirmedAt?: any;
};

type UserMap = Record<string, { name?: string; email?: string }>;
type CustomerMap = Record<string, { name?: string; phone?: string }>;

function safeNum(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function monthKey(value: any) {
  const date = toDate(value);
  return date ? format(date, "yyyy-MM") : "";
}

function displayDate(value: any) {
  const date = toDate(value);
  return date ? format(date, "MMM d, yyyy HH:mm") : "-";
}

export default function AccountingPage() {
  const { user, loading: authLoading, privileges } = useAuth();
  const canView = privileges?.["accounting.view"] ?? false;
  const canConfirm = usePrivilege("accounting.confirm");

  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [customers, setCustomers] = useState<CustomerMap>({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;
      if (!user || !canView) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [entriesSnap, usersSnap, customersSnap] = await Promise.all([
          getDocs(collection(db, "accountingEntries")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "customers")),
        ]);

        const nextEntries = entriesSnap.docs
          .map((entryDoc) => ({
            id: entryDoc.id,
            ...(entryDoc.data() as Omit<AccountingEntry, "id">),
          }))
          .sort((a, b) => {
            const aDate = toDate(a.createdAt)?.getTime() ?? 0;
            const bDate = toDate(b.createdAt)?.getTime() ?? 0;
            return bDate - aDate;
          });

        const nextUsers: UserMap = {};
        usersSnap.docs.forEach((userDoc) => {
          const data = userDoc.data() as any;
          nextUsers[userDoc.id] = {
            name: data.name,
            email: data.email,
          };
        });

        const nextCustomers: CustomerMap = {};
        customersSnap.docs.forEach((customerDoc) => {
          const data = customerDoc.data() as any;
          nextCustomers[customerDoc.id] = {
            name: data.name,
            phone: data.phone,
          };
        });

        setEntries(nextEntries);
        setUsers(nextUsers);
        setCustomers(nextCustomers);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load accounting entries");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, canView, user]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (directionFilter !== "all" && entry.direction !== directionFilter) {
        return false;
      }
      if (monthFilter && monthKey(entry.createdAt) !== monthFilter) return false;
      if (employeeFilter !== "all" && entry.createdBy !== employeeFilter) {
        return false;
      }
      return true;
    });
  }, [entries, statusFilter, directionFilter, monthFilter, employeeFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        const bucket = entry.status === "confirmed" ? "confirmed" : "pending";
        const direction = entry.direction === "in" ? "in" : "out";
        acc[bucket][direction] += safeNum(entry.amount);
        return acc;
      },
      {
        pending: { in: 0, out: 0 },
        confirmed: { in: 0, out: 0 },
      }
    );
  }, [filteredEntries]);

  const employeeOptions = useMemo(() => {
    const ids = Array.from(
      new Set(entries.map((entry) => entry.createdBy).filter(Boolean))
    ) as string[];
    return ids.sort((a, b) => {
      const an = users[a]?.name || users[a]?.email || a;
      const bn = users[b]?.name || users[b]?.email || b;
      return an.localeCompare(bn);
    });
  }, [entries, users]);

  const confirmEntry = async (entryId: string) => {
    if (!canConfirm) {
      toast.error("You do not have permission to confirm entries.");
      return;
    }

    try {
      setConfirmingId(entryId);
      await updateDoc(doc(db, "accountingEntries", entryId), {
        status: "confirmed",
        confirmedBy: user?.uid || null,
        confirmedAt: serverTimestamp(),
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "confirmed",
                confirmedBy: user?.uid || null,
                confirmedAt: new Date(),
              }
            : entry
        )
      );
      toast.success("Entry confirmed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm entry");
    } finally {
      setConfirmingId(null);
    }
  };

  const totalCard = (
    title: string,
    inAmount: number,
    outAmount: number,
    tone: string
  ) => (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>In</span>
          <span className="font-semibold text-emerald-600">{inAmount} SAR</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Out</span>
          <span className="font-semibold text-rose-600">{outAmount} SAR</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Net</span>
          <span className={`font-semibold ${tone}`}>
            {inAmount - outAmount} SAR
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="accounting.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h2 className="font-semibold">Accounting</h2>
            </div>
            <ThemeToggle />
          </header>

          <div className="min-h-screen space-y-6 bg-muted/10 p-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {totalCard(
                "Pending Entries",
                totals.pending.in,
                totals.pending.out,
                "text-amber-600"
              )}
              {totalCard(
                "Confirmed Entries",
                totals.confirmed.in,
                totals.confirmed.out,
                "text-emerald-600"
              )}
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <Label className="my-2">Status</Label>
                  <select
                    className="h-10 w-full rounded border bg-background px-2"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                <div>
                  <Label className="my-2">Direction</Label>
                  <select
                    className="h-10 w-full rounded border bg-background px-2"
                    value={directionFilter}
                    onChange={(event) => setDirectionFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                  </select>
                </div>

                <div>
                  <Label className="my-2">Month</Label>
                  <Input
                    type="month"
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.target.value)}
                  />
                </div>

                <div>
                  <Label className="my-2">Employee</Label>
                  <select
                    className="h-10 w-full rounded border bg-background px-2"
                    value={employeeFilter}
                    onChange={(event) => setEmployeeFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    {employeeOptions.map((employeeId) => (
                      <option key={employeeId} value={employeeId}>
                        {users[employeeId]?.name ||
                          users[employeeId]?.email ||
                          employeeId}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle>Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Loading accounting entries...
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No entries found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-3 pr-3 font-medium">Entry</th>
                          <th className="py-3 pr-3 font-medium">Customer</th>
                          <th className="py-3 pr-3 font-medium">Employee</th>
                          <th className="py-3 pr-3 font-medium">Method</th>
                          <th className="py-3 pr-3 font-medium">Fee</th>
                          <th className="py-3 pr-3 font-medium">Amount</th>
                          <th className="py-3 pr-3 font-medium">Status</th>
                          <th className="py-3 pr-3 font-medium">Created</th>
                          <th className="py-3 pr-3 font-medium">File</th>
                          <th className="py-3 pr-3 text-right font-medium">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => {
                          const customer = customers[entry.customerId];
                          const employee = entry.createdBy
                            ? users[entry.createdBy]
                            : null;
                          const isIn = entry.direction === "in";

                          return (
                            <tr key={entry.id} className="border-b last:border-0">
                              <td className="py-4 pr-3 align-top">
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`mt-1 rounded-full p-1.5 ${
                                      isIn
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-rose-100 text-rose-700"
                                    }`}
                                  >
                                    {isIn ? (
                                      <ArrowDownLeft className="h-4 w-4" />
                                    ) : (
                                      <ArrowUpRight className="h-4 w-4" />
                                    )}
                                  </span>
                                  <div>
                                    <div className="font-medium">
                                      {entry.description || "-"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {entry.sourceType.split("_").join(" ")} ·{" "}
                                      {entry.orderId}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 pr-3 align-top">
                                <div className="font-medium">
                                  {customer?.name || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer?.phone || entry.customerId}
                                </div>
                              </td>
                              <td className="py-4 pr-3 align-top">
                                <div>{employee?.name || employee?.email || "-"}</div>
                              </td>
                              <td className="py-4 pr-3 align-top">
                                {entry.paymentMethodName ? (
                                  <div>
                                    <div>{entry.paymentMethodName}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {safeNum(entry.paymentMethodPercentageRate)}% +{" "}
                                      {safeNum(entry.paymentMethodFixedFee)} SAR
                                    </div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="py-4 pr-3 align-top">
                                {typeof entry.paymentMethodFeeAmount === "number"
                                  ? `${entry.paymentMethodFeeAmount} SAR`
                                  : "-"}
                              </td>
                              <td
                                className={`py-4 pr-3 align-top font-semibold ${
                                  isIn ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {isIn ? "+" : "-"}
                                {safeNum(entry.amount)} {entry.currency || "SAR"}
                              </td>
                              <td className="py-4 pr-3 align-top">
                                <Badge
                                  variant={
                                    entry.status === "confirmed"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {entry.status}
                                </Badge>
                              </td>
                              <td className="py-4 pr-3 align-top">
                                {displayDate(entry.createdAt)}
                              </td>
                              <td className="py-4 pr-3 align-top">
                                {entry.file?.url ? (
                                  <Button asChild variant="outline" size="sm">
                                    <a
                                      href={entry.file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <ExternalLink className="mr-1 h-4 w-4" />
                                      Open
                                    </a>
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="py-4 pr-3 text-right align-top">
                                {entry.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    onClick={() => confirmEntry(entry.id)}
                                    disabled={!canConfirm || confirmingId === entry.id}
                                  >
                                    <CheckCircle2 className="mr-1 h-4 w-4" />
                                    {confirmingId === entry.id
                                      ? "Confirming..."
                                      : "Confirm"}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Confirmed
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
