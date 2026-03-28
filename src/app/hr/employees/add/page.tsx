"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { LoadingProgress } from "@/components/loading-progrss";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useAuth } from "@/hooks/useAuth";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

export default function AddEmployeePage() {
  const { user, loading } = useAuth(true);
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "",
  });

  const departments = [
    "Sales",
    "Visa Department",
    "Accounting",
    "Operations",
    "Management",
  ];

  const roles = ["admin", "manager", "sales", "accountant", "visa"];

  const handleChange = (key: string, value: string) =>
    setForm({ ...form, [key]: value });

  // 📤 Upload image to Firebase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const fileRef = ref(storage, `employees/${uuidv4()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setImageURL(url);

      toast.success("Photo uploaded", {
        description: "Employee photo uploaded successfully.",
      });
    } catch (error) {
      console.error(error);
      toast.error("Upload failed", {
        description: "Could not upload the image. Try again later.",
      });
    } finally {
      setUploading(false);
    }
  };

  // 🧩 Submit and create user in Auth + Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          password: password || "12345678", // default password
          photoURL: imageURL,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Employee added", {
          description: `${form.name} was created successfully.`,
        });
        router.push("/hr/employees");
      } else {
        toast.error("Error adding employee", { description: data.message });
      }
    } catch (err: any) {
      toast.error("Unexpected error", {
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <LoadingProgress />;
  if (!user) return null;

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="employees.add">
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-4">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Home page</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />

                 <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/hr">HR Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />

                  <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/hr/employees">Employees</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Add Employee</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <ThemeToggle />
        </header>

        {/* PAGE CONTENT */}
        <motion.div
          className="flex flex-1 flex-col gap-6 p-6 pt-4 bg-muted/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl w-full ">
            {/* LEFT FORM */}
            <Card className="col-span-2 shadow-sm border border-border/60 hover:shadow-md transition-all">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-primary">
                  Add New Employee
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fill out the form to create a new employee account.
                </p>
              </CardHeader>

              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label className="my-2">Employee Photo</Label>
                    <Input type="file" accept="image/*" onChange={handleImageUpload} />
                    {uploading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploading...
                      </p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="my-2">Full Name</Label>
                      <Input
                        placeholder="Employee name"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label className="my-2">Email Address</Label>
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="my-2">Phone Number</Label>
                      <Input
                        type="tel"
                        placeholder="+966 5xxxxxxxx"
                        value={form.phone}
                        onChange={(e) =>
                          handleChange("phone", e.target.value)
                        }
                      />
                    </div>

                    <div >
                      <Label className="my-2">Department</Label>
                      <Select  
                      
                        onValueChange={(value) =>
                          handleChange("department", value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dep) => (
                            <SelectItem key={dep} value={dep}>
                              {dep}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="my-2">Role</Label>
                      <Select
                        onValueChange={(value) => handleChange("role", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="my-2">Password</Label>
                      <Input
                        type="password"
                        placeholder="Default: 12345678"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full mt-4"
                  >
                    {isSaving ? "Saving..." : "Add Employee"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RIGHT PREVIEW CARD */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 flex flex-col items-center text-center shadow-sm">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={imageURL || "/default-avatar.png"} />
                  <AvatarFallback>EMP</AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold">
                  {form.name || "Employee Name"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {form.role || "Role not selected"}
                </p>
                <Separator className="my-4 w-3/4" />
                <p className="text-sm">
                  <span className="font-medium">Department:</span>{" "}
                  {form.department || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Email:</span>{" "}
                  {form.email || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Phone:</span>{" "}
                  {form.phone || "N/A"}
                </p>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
