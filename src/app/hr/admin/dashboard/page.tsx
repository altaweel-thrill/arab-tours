"use client";

import { AppSidebar } from "@/components/app-sidebar";
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
import { Plus, Users, Briefcase, CalendarDays, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

export default function Hr() {
  const router = useRouter();


  
  const stats = [
    { title: "Total Employees", value: "124", icon: Users },
    { title: "Departments", value: "8", icon: Briefcase },
    { title: "Attendance Today", value: "97%", icon: Clock },
    { title: "Upcoming Leaves", value: "5", icon: CalendarDays },
  ];

  const data = [
    { month: "Jan", employees: 90 },
    { month: "Feb", employees: 95 },
    { month: "Mar", employees: 100 },
    { month: "Apr", employees: 105 },
    { month: "May", employees: 110 },
    { month: "Jun", employees: 124 },
  ];

  const recentEmployees = [
    { name: "Ahmad Al-Taweel", department: "IT", position: "Developer", status: "Active", joined: "2024-02-14" },
    { name: "Sarah Ali", department: "HR", position: "Manager", status: "Active", joined: "2023-11-02" },
    { name: "Omar Khaled", department: "Marketing", position: "Executive", status: "On Leave", joined: "2023-08-10" },
  ];

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="admin.hr">
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
                  <BreadcrumbPage>HR Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="ml-auto px-4 flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.push("/hr/add-employee")}>
              <Plus />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Overview Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item, i) => (
              <Card key={i} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart Section */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Employee Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="employees" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Employees Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEmployees.map((emp, i) => (
                    <TableRow key={i}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell>{emp.status}</TableCell>
                      <TableCell>{emp.joined}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}
