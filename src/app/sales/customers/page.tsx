"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, ArrowUpDown, Plus } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/notifications/NotificationsBell";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nationality?: string;
  createdAt?: any;
  createdBy?: string;
};

export default function CustomersListPage() {
  const { user } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Customer | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchCustomers();
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, "customers"),
        where("createdBy", "==", user.uid)
      );

      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Customer[];

      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof Customer) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    let list = [...customers];

    if (s) {
      list = list.filter((c) =>
        `${c.name} ${c.phone} ${c.email ?? ""} ${c.nationality ?? ""}`
          .toLowerCase()
          .includes(s)
      );
    }

    if (sortBy) {
      list.sort((a: any, b: any) => {
        const v1 = a[sortBy] ?? "";
        const v2 = b[sortBy] ?? "";
        if (v1 < v2) return sortDir === "asc" ? -1 : 1;
        if (v1 > v2) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [search, customers, sortBy, sortDir]);

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
                    <BreadcrumbPage>Customers</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild size="sm">
                <Link href="/sales/customers/add">Add Customer</Link>
              </Button>
                <div className="ml-auto flex items-center gap-2">
                         <NotificationsBell userId={user?.uid ?? " " } />
                         <ThemeToggle />
                       </div>
            </div>
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <div className="max-w-sm mb-6">
              <Label htmlFor="search" className="my-2 block">
                Search Customers
              </Label>
              <Input
                id="search"
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="rounded-xl border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      onClick={() => handleSort("name")}
                      className="cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown size={14} />
                      </div>
                    </TableHead>

                    <TableHead
                      onClick={() => handleSort("phone")}
                      className="cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        Phone
                        <ArrowUpDown size={14} />
                      </div>
                    </TableHead>

                    <TableHead>Email</TableHead>
                    <TableHead>Nationality</TableHead>

                    <TableHead
                      onClick={() => handleSort("createdAt")}
                      className="cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        Created
                        <ArrowUpDown size={14} />
                      </div>
                    </TableHead>

                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-muted-foreground"
                      >
                        No customers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.name}
                        </TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.email || "-"}</TableCell>
                        <TableCell>{c.nationality || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.createdAt?.seconds
                            ? format(
                                new Date(c.createdAt.seconds * 1000),
                                "yyyy-MM-dd"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Link href={`/sales/customers/${c.id}`}>
                            <Button variant="outline" size="icon">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>

                           <Link href={`/sales/customers/${c.id}/add-sale`}>
                                     <Button
  size="sm"
  className="bg-emerald-600 hover:bg-emerald-700 text-white"

>
  + Add Sales
</Button>
                          </Link>


                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground mt-3">
              Showing {filtered.length} of {customers.length} customers
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}