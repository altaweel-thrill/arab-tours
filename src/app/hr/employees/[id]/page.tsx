"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, Briefcase, ArrowLeft } from "lucide-react";
import { parseISO } from "date-fns";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LoadingProgress } from "@/components/loading-progrss";
import Link from "next/link";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import { usePrivilege } from "@/hooks/usePrivilege";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
    const canEditProfile = usePrivilege("employees.edit");
     const canManagePrivileges = usePrivilege("settings.privileges");


  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const ref = doc(db, "users", id as string);
        const snap = await getDoc(ref);
        if (snap.exists()) setEmployee(snap.data());
      } catch (e) {
        console.error("Error loading employee:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <LoadingProgress />;
  if (!employee)
    return <div className="p-6 text-center text-muted-foreground">Employee not found.</div>;

  // 📊 Fake data for attendance visualization
  const attendanceData = [
    { day: "Mon", present: 1 },
    { day: "Tue", present: 1 },
    { day: "Wed", present: 0 },
    { day: "Thu", present: 1 },
    { day: "Fri", present: 1 },
  ];

  const attendanceRecords = [
    { date: "2025-10-01", present: true },
    { date: "2025-10-02", present: true },
    { date: "2025-10-03", present: false },
    { date: "2025-10-04", present: true },
  ];

  const presentDays = attendanceRecords.filter((d) => d.present).map((d) => parseISO(d.date));
  const absentDays = attendanceRecords.filter((d) => !d.present).map((d) => parseISO(d.date));
  return (
    <ProtectedRoute>
    <ProtectedRouteWithPrivilege requiredPrivilege="employees.view">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home page</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/hr/employees">Employees</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Profile</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="ml-auto px-4 flex items-center gap-2">
             
              <ThemeToggle />
            </div>
          </header>

          {/* Main Content */}
          <div className="min-h-screen bg-background p-6 space-y-8">
            {/* User Info */}
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={employee.photoURL || ""} />
                  <AvatarFallback>
                    {employee.name?.charAt(0).toUpperCase() ?? "E"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-semibold">{employee.name || "Employee"}</h1>
                  <p className="text-sm text-muted-foreground">
                    Department: {employee.department || "Not specified"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
               {canEditProfile && ( <Button  variant="outline">Edit Profile</Button>)}
                {canManagePrivileges && ( <Button asChild variant="outline"><Link href={`/hr/employees/${id}/privileges`}>Manage Privileges</Link></Button>)}
              </div>
            </header>

            <Separator />

            {/* Stats Section */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {employee.attendanceRate || "95%"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {employee.leaveBalance || "12"} Days
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Role</CardTitle>
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">
                    {employee.role || "N/A"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <Tooltip />
                    <Line type="monotone" dataKey="present" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance Calendar */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance Calendar (October 2025)</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  month={new Date(2025, 9)} // October
                  modifiers={{ present: presentDays, absent: absentDays }}
                  modifiersClassNames={{
                    present: "bg-green-100 text-green-800 font-semibold rounded-full",
                    absent: "bg-red-100 text-red-800 font-semibold rounded-full",
                  }}
                />
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-400 rounded-full" /> Present
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-400 rounded-full" /> Absent
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
    </ProtectedRoute>
  );
}
