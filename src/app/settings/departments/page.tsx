"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, PlusCircle, Building2 } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

type Department = {
  id: string;
  name: string;
  createdAt?: string;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDept, setNewDept] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const q = query(collection(db, "departments"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Department[];
      setDepartments(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load departments");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAdd = async () => {
    if (!newDept.trim()) {
      toast.error("Department name is required");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "departments"), {
        name: newDept.trim(),
        createdAt: serverTimestamp(),
      });
      setNewDept("");
      toast.success("Department added successfully 🎉");
      fetchDepartments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add department");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await deleteDoc(doc(db, "departments", id));
      toast.success("Department deleted");
      fetchDepartments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete department");
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="departments.manage">
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
                  <BreadcrumbLink href="/">Home Page</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Departments</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-8 bg-muted/10 min-h-screen">
          <div className="max-w-3xl  space-y-6">
            <Card className="shadow-md border rounded-2xl">
              <CardHeader className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-semibold">
                    Department Management
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                {/* Add Form */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    placeholder="Enter new department name..."
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAdd}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 transition-all"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Department
                  </Button>
                </div>

                <Separator />

                {/* Department List */}
                <div className="mt-6">
                  {departments.length === 0 ? (
                    <p className="text-center text-muted-foreground mt-6">
                      No departments added yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {departments.map((d, i) => (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className="flex items-center justify-between border rounded-xl p-3 bg-card hover:bg-accent/20 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {d.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{d.name}</span>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(d.id)}
                              className="hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
