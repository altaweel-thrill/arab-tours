"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

type Sale = {
  total: number;
  createdBy: string;
  items?: {
    productId: string;
    productName: string;
    price: number;
    qty: number;
  }[];
};

type UserMap = Record<string, string>;

export default function SalesTeamDashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    loadData();
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const salesSnap = await getDocs(collection(db, "sales"));
      setSales(salesSnap.docs.map(d => d.data() as Sale));

      const usersSnap = await getDocs(collection(db, "users"));
      const map: UserMap = {};
      usersSnap.docs.forEach(u => {
        map[u.id] = u.data()?.name || u.data()?.email || "—";
      });
      setUsers(map);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sales data");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Aggregations ---------------- */

  const totalRevenue = useMemo(
    () => sales.reduce((a, b) => a + (b.total || 0), 0),
    [sales]
  );

  const salesByUser = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    sales.forEach(s => {
      if (!map[s.createdBy]) {
        map[s.createdBy] = { count: 0, revenue: 0 };
      }
      map[s.createdBy].count += 1;
      map[s.createdBy].revenue += s.total || 0;
    });
    return map;
  }, [sales]);

  const topSalesPerson = useMemo(() => {
    return Object.entries(salesByUser).sort(
      (a, b) => b[1].revenue - a[1].revenue
    )[0];
  }, [salesByUser]);

  const productsStats = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};

    sales.forEach(s => {
      s.items?.forEach(i => {
        if (!map[i.productId]) {
          map[i.productId] = {
            name: i.productName,
            qty: 0,
            revenue: 0,
          };
        }
        map[i.productId].qty += i.qty;
        map[i.productId].revenue += i.price * i.qty;
      });
    });

    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [sales]);


  return (
   
   
   <ProtectedRouteWithPrivilege requiredPrivilege="management.view">
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
                    <BreadcrumbLink href="/sales">Sales</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Management Sales</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
           <div className="ml-auto flex items-center gap-2">
                                  <NotificationsBell userId={currentUser?.uid ?? " " } />
                                  <ThemeToggle />
                                </div>
                     </header>
      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPI title="Total Revenue" value={formatCurrency(totalRevenue)} />
          <KPI title="Total Sales" value={sales.length} />
          <KPI title="Sales Team" value={Object.keys(salesByUser).length} />
          {topSalesPerson && (
            <KPI
              title="Top Sales Person"
              value={users[topSalesPerson[0]]}
            />
          )}
        </div>

        {/* Sales Team Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Total Revenue</TableHead>
                  <TableHead>Avg Sale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(salesByUser).map(([uid, v]) => (
                  <TableRow key={uid}>
                    <TableCell>{users[uid]}</TableCell>
                    <TableCell>{v.count}</TableCell>
                    <TableCell>{formatCurrency(v.revenue)}</TableCell>
                    <TableCell>
                      {formatCurrency(v.revenue / v.count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Sold Qty</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsStats.slice(0, 5).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.qty}</TableCell>
                    <TableCell>{formatCurrency(p.revenue)}</TableCell>
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

/* ---------------- Small Components ---------------- */

function KPI({ title, value }: { title: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}