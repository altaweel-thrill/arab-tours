"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, Briefcase } from "lucide-react";
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

export default function UserDashboard() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          setUserData(snap.exists() ? snap.data() : null);
        } catch (error) {
          console.error("Error fetching user:", error);
          setUserData(null);
        }
      } else {
        setFirebaseUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingProgress />;
  if (!firebaseUser) return <div className="p-6 text-center">Please log in.</div>;
  if (!userData) return <div className="p-6 text-center">No user data found.</div>;

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
            <ThemeToggle />
          </div>
        </header>

        <div className="min-h-screen bg-background p-6 space-y-8">
          {/* User Info */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={firebaseUser.photoURL || ""} />
                <AvatarFallback>
                  {firebaseUser.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">
                  Welcome, {userData.name || firebaseUser.displayName || "User"} 👋
                </h1>
                <p className="text-sm text-muted-foreground">
                  Department: {userData.department || "Not specified"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Edit Profile</Button>
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
                  {userData.attendanceRate || "95%"}
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
                  {userData.leaveBalance || "12"} Days
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Department</CardTitle>
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userData.department || "N/A"}
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

          {/* Calendar */}
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
  );
}
