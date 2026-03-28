"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, ArrowUpDown } from "lucide-react";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { usePrivilege } from "@/hooks/usePrivilege";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "destination" | "price" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const canAdd = usePrivilege("packages.add");

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const snap = await getDocs(collection(db, "packages"));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPackages(data);
    } catch (error) {
      console.error("Error fetching packages:", error);
    }
  };

  const handleSort = (key: "name" | "destination" | "price") => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = [...packages];
    if (term) {
      result = result.filter(
        (p) =>
          `${p.name ?? ""} ${p.destination ?? ""}`.toLowerCase().includes(term)
      );
    }
    if (sortBy) {
      result.sort((a, b) => {
        const v1 = a[sortBy] ?? "";
        const v2 = b[sortBy] ?? "";
        if (v1 < v2) return sortDir === "asc" ? -1 : 1;
        if (v1 > v2) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [packages, search, sortBy, sortDir]);

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="packages.view">
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
                    <BreadcrumbLink href="/operations">Operations</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Packages</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              {canAdd && (
                <Button size="sm" asChild>
                  <a href="/operations/packages/add">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Package
                  </a>
                </Button>
              )}
              <ThemeToggle />
            </div>
          </header>

          {/* CONTENT */}
          <div className="flex flex-col gap-6 p-6 pt-4 bg-muted/10">
            {/* Search */}
            <div className="max-w-sm">
              <Label htmlFor="search" className="mb-1 block">
                Search Packages
              </Label>
              <Input
                id="search"
                placeholder="Search by name or destination..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Packages Table */}
            <div className="rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort("name")} className="cursor-pointer">
                      <div className="flex items-center gap-1">
                        Name <ArrowUpDown size={14} />
                      </div>
                    </TableHead>
                    <TableHead onClick={() => handleSort("destination")} className="cursor-pointer">
                      <div className="flex items-center gap-1">
                        Destination <ArrowUpDown size={14} />
                      </div>
                    </TableHead>
                    <TableHead onClick={() => handleSort("price")} className="cursor-pointer">
                      <div className="flex items-center gap-1">
                        Price (SAR) <ArrowUpDown size={14} />
                      </div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        No packages found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name ?? "-"}</TableCell>
                        <TableCell>{p.destination ?? "-"}</TableCell>
                        <TableCell>{p.price ?? "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-semibold ${
                              p.status === "active"
                                ? "text-emerald-600"
                                : "text-gray-500"
                            }`}
                          >
                            {p.status ?? "active"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">
              Showing {filtered.length} of {packages.length} packages
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}