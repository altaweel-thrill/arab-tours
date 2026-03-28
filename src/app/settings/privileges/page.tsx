"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
} from "@/components/ui/breadcrumb";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { rolePrivileges } from "@/lib/roles";

// 🔑 Group privileges by module
const privilegeGroups = {
  employees: ["employees.view", "employees.add", "employees.edit", "employees.delete"],
  departments: ["departments.view", "departments.manage"],
  reports: ["reports.view", "reports.export"],
  settings: ["settings.update", "settings.privileges"],
};

export default function PrivilegesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (userId: string, key: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              privileges: {
                ...user.privileges,
                [key]: !user.privileges?.[key],
              },
            }
          : user
      )
    );
  };

  const handleGroupToggle = (userId: string, group: string, state: boolean) => {
    const keys = privilegeGroups[group as keyof typeof privilegeGroups];
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              privileges: {
                ...user.privileges,
                ...Object.fromEntries(keys.map((k) => [k, state])),
              },
            }
          : user
      )
    );
    toast.success(`${state ? "Selected" : "Unselected"} all in ${group}`);
  };

  const handleSave = async (userId: string, privileges: Record<string, boolean>) => {
    try {
      const ref = doc(db, "users", userId);
      await updateDoc(ref, { privileges });
      toast.success("Privileges updated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update privileges");
    }
  };

  const handleApplyRole = async (userId: string, role: string) => {
    try {
const privileges = rolePrivileges[role as keyof typeof rolePrivileges] || {};
      const ref = doc(db, "users", userId);
      await updateDoc(ref, { privileges });
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, privileges } : user
        )
      );
      toast.success(`Applied ${role} privileges successfully!`);
    } catch (error) {
      toast.error("Failed to apply role privileges");
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="settings.privileges">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 items-center gap-2 border-b bg-background/70 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Privileges</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Content */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>User Privileges Management</CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-6">Loading...</p>
                ) : users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No users found.</p>
                ) : (
                  <div className="space-y-6">
                    {users.map((user) => (
                      <Card key={user.id} className="border border-border p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h2 className="font-semibold">{user.name || "—"}</h2>
                            <p className="text-xs text-muted-foreground">{user.role || "—"}</p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleApplyRole(user.id, user.role)}
                            >
                              Apply {user.role} Template
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSave(user.id, user.privileges)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>

                        <Accordion type="multiple" className="w-full">
                          {Object.entries(privilegeGroups).map(([group, keys]) => (
                            <AccordionItem key={group} value={group}>
                              <AccordionTrigger className="capitalize text-sm font-medium flex justify-between items-center">
  <span>{group}</span>
  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
    <div
      onClick={() => handleGroupToggle(user.id, group, true)}
      className="cursor-pointer text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-accent/40"
    >
      Select All
    </div>
    <div
      onClick={() => handleGroupToggle(user.id, group, false)}
      className="cursor-pointer text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-accent/40"
    >
      Unselect
    </div>
  </div>
</AccordionTrigger>

                              <AccordionContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                                  {keys.map((key) => (
                                    <div key={key} className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={user.privileges?.[key] ?? false}
                                        onCheckedChange={() => handleToggle(user.id, key)}
                                      />
                                      <span className="text-sm capitalize">{key.replace(".", " ")}</span>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </Card>
                    ))}
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
