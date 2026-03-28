"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { AppSidebar } from "@/components/app-sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpDown } from "lucide-react";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { usePrivilege } from "@/hooks/usePrivilege";

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  role?: string;
  status?: string;
  photoURL?: string;
  createdAt?: string;
};

export default function UsersClient({ employees }: { employees: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof UserRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: keyof UserRow) => {
    if (sortBy === key) {
      // toggle direction
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let result = [...employees];

    // 🔍 بحث محلي
    if (s) {
      result = result.filter((e) =>
        `${e.name ?? ""} ${e.email ?? ""} ${e.phone ?? ""}`
          .toLowerCase()
          .includes(s)
      );
    }

    // 🔽 ترتيب حسب العمود المحدد
    if (sortBy) {
      result.sort((a: any, b: any) => {
        const v1 = a[sortBy] ?? "";
        const v2 = b[sortBy] ?? "";
        if (v1 < v2) return sortDir === "asc" ? -1 : 1;
        if (v1 > v2) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [search, employees, sortBy, sortDir]);

  const canAdd = usePrivilege("employees.add");

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="employees.view">
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
                  <BreadcrumbLink href="/">Home Page</BreadcrumbLink>
                </BreadcrumbItem>
                
                <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/hr">HR</BreadcrumbLink>
                </BreadcrumbItem>
                
                <BreadcrumbSeparator className="hidden md:block" />

                <BreadcrumbItem>
                  <BreadcrumbPage>Employees</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
             {canAdd && (
              <Button asChild size="sm">
                <Link href="/hr/employees/add">Add Employee</Link>
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
              Search Employees
            </Label>
            <Input
              id="search"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Avatar</TableHead>

                  <TableHead onClick={() => handleSort("name")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Name
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                  <TableHead onClick={() => handleSort("email")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Email
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                  <TableHead onClick={() => handleSort("department")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Department
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                  <TableHead onClick={() => handleSort("role")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Role
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                  <TableHead onClick={() => handleSort("status")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Status
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                  <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Created
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>
                   <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      Actions
                      <ArrowUpDown size={14} />
                    </div>
                  </TableHead>

                 
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.photoURL || ""} />
                          <AvatarFallback>
                            {(u.name?.[0] ?? "E").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{u.name ?? "-"}</TableCell>
                      <TableCell>{u.email ?? "-"}</TableCell>
                      <TableCell>{u.department ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {u.role ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            u.status === "active"
                              ? "bg-emerald-600 hover:bg-emerald-600"
                              : "bg-gray-500"
                          }
                        >
                          {u.status ?? "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.createdAt
                          ? format(new Date(u.createdAt), "yyyy-MM-dd")
                          : "-"}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/hr/employees/${u.id}`}>View</Link>
                      </Button>
                    </TableCell>

                      
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {employees.length} employees
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
