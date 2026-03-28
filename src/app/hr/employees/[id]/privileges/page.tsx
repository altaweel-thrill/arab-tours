"use client";
export const dynamic = "force-client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { LoadingProgress } from "@/components/loading-progrss";
import { rolePrivileges } from "@/lib/roles";
import { ThemeToggle } from "@/components/theme-toggle";
export default function EditEmployeePrivilegesPage() {
  const { id } = useParams();
  const router = useRouter();

  const [employee, setEmployee] = useState<any>(null);
  const [privileges, setPrivileges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // 🔹 Load employee data
  useEffect(() => {
    if (!id) return;
    const fetchEmployee = async () => {
      try {
        const ref = doc(db, "users", id as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setEmployee(data);
          setPrivileges(data.privileges || {});
        }
      } catch (e) {
        console.error("Error loading employee:", e);
        toast.error("Failed to load employee data.");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  // 🔹 Collect all privileges across roles
  const allPrivilegeKeys = Array.from(
    new Set(Object.values(rolePrivileges).flatMap((r) => Object.keys(r)))
  );

  // 🔹 Group privileges by section (prefix before '.')
  const grouped: Record<string, string[]> = {};
  allPrivilegeKeys.forEach((key) => {
    const [group] = key.split(".");
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(key);
  });

  // Toggle individual privilege
  const handleToggle = (key: string) => {
    setPrivileges((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Apply current role privileges
  const handleApplyRole = () => {
    if (!employee?.role) {
      toast.error("Employee has no role assigned.");
      return;
    }

    const role = employee.role as keyof typeof rolePrivileges;
    const roleData = rolePrivileges[role];
    if (!roleData) {
      toast.error(`Role '${role}' not found in rolePrivileges`);
      return;
    }

    setPrivileges(roleData);
    toast.info(`Applied ${role} role privileges`);
  };

  // Clear all privileges
  const handleClearAll = () => {
    const cleared = Object.fromEntries(allPrivilegeKeys.map((k) => [k, false]));
    setPrivileges(cleared);
    toast.info("All privileges cleared");
  };

  // Save changes
  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "users", id as string), { privileges });
      toast.success("Privileges updated successfully!");
     
    } catch (error) {
      console.error(error);
      toast.error("Failed to update privileges");
    }
  };

  if (loading) return <LoadingProgress />;
  if (!employee)
    return <div className="p-6 text-center text-muted-foreground">Employee not found.</div>;

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="settings.privileges">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 items-center gap-2 border-b bg-background/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home Page</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/hr/employees">Employees</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Edit Privileges</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="ml-auto flex items-center gap-2">
               <ThemeToggle />
            </div>
          </header>

          {/* Content */}
          <div className="p-6 bg-muted/10 min-h-screen space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold">
                Manage Privileges for{" "}
                <span className="text-primary">{employee.name || "Employee"}</span>
              </h1>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleApplyRole}>
                  Apply {employee.role} Role
                </Button>
                <Button variant="outline" onClick={handleClearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            {/* Cards for each group */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(grouped).map(([group, keys]) => (
                <Card key={group} className="border shadow-sm">
                  <CardHeader>
                    <CardTitle className="capitalize text-base flex justify-between items-center">
                      {group}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPrivileges((prev) => {
                            const updated = { ...prev };
                            const allEnabled = keys.every((k) => updated[k]);
                            keys.forEach((k) => (updated[k] = !allEnabled));
                            return updated;
                          })
                        }
                      >
                        {keys.every((k) => privileges[k]) ? "Unselect All" : "Select All"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {keys.map((key) => (
                      <div
                        key={key}
                        className="flex items-center space-x-2 border p-2 rounded-md hover:bg-accent/30 transition"
                      >
                        <Checkbox
                          id={key}
                          checked={privileges[key] ?? false}
                          onCheckedChange={() => handleToggle(key)}
                        />
                        <label htmlFor={key} className="text-sm cursor-pointer capitalize">
                          {key.split(".")[1].replace("-", " ")}
                        </label>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="flex justify-end">
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
