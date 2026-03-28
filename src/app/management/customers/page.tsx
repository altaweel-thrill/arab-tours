"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, ArrowUpDown } from "lucide-react";

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
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { useAuth } from "@/context/AuthContext";

/* ---------------- Types ---------------- */

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nationality?: string;
  createdAt?: any;
  createdBy?: string;
};

type UserMap = Record<string, string>;

/* ---------------- Component ---------------- */

export default function CustomersWithCreatorPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usersMap, setUsersMap] = useState<UserMap>({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Customer | "createdByName" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      /* 1️⃣ Fetch customers */
      const custSnap = await getDocs(collection(db, "customers"));
      const custData = custSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Customer[];

      setCustomers(custData);

      /* 2️⃣ Fetch users (once) */
      const usersSnap = await getDocs(collection(db, "users"));
      const map: UserMap = {};
      usersSnap.docs.forEach((d) => {
        map[d.id] = d.data()?.name || d.data()?.email || "—";
      });
      setUsersMap(map);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof Customer | "createdByName") => {
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
        `${c.name} ${c.phone} ${c.email ?? ""} ${usersMap[c.createdBy ?? ""] ?? ""}`
          .toLowerCase()
          .includes(s)
      );
    }

    if (sortBy) {
      list.sort((a: any, b: any) => {
        const v1 =
          sortBy === "createdByName"
            ? usersMap[a.createdBy ?? ""] ?? ""
            : a[sortBy] ?? "";

        const v2 =
          sortBy === "createdByName"
            ? usersMap[b.createdBy ?? ""] ?? ""
            : b[sortBy] ?? "";

        if (v1 < v2) return sortDir === "asc" ? -1 : 1;
        if (v1 > v2) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [customers, usersMap, search, sortBy, sortDir]);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="management.customers-view">
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
                  <BreadcrumbItem>
                    <BreadcrumbPage>Customers</BreadcrumbPage>
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
            <div className="max-w-sm mb-6">
              <Label className="my-2 block">Search</Label>
              <Input
                placeholder="Search customer or creator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="rounded-xl border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort("name")} className="cursor-pointer">
                      Name <ArrowUpDown size={14} />
                    </TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nationality</TableHead>

                    <TableHead
                      onClick={() => handleSort("createdByName")}
                      className="cursor-pointer"
                    >
                      Created By <ArrowUpDown size={14} />
                    </TableHead>

                    <TableHead
                      onClick={() => handleSort("createdAt")}
                      className="cursor-pointer"
                    >
                      Created At <ArrowUpDown size={14} />
                    </TableHead>

                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.email || "-"}</TableCell>
                        <TableCell>{c.nationality || "-"}</TableCell>
                        <TableCell>
                          {usersMap[c.createdBy ?? ""] || "—"}
                        </TableCell>
                        <TableCell>
                          {c.createdAt?.seconds
                            ? format(
                                new Date(c.createdAt.seconds * 1000),
                                "yyyy-MM-dd"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/sales/customers/${c.id}`}>
                            <Button size="icon" variant="outline">
                              <Eye className="w-4 h-4" />
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