"use client";

import { NavMain, type NavMainItem } from "@/components/nav-main"; // ✅ النوع هنا
import {
  AudioWaveform,
  BarChart,
  BookOpen,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    const fetchUser = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setProfile(snap.data());
    };
    fetchUser();
  }, [user]);

  const privileges = profile?.privileges || {};

  // ✅ القائمة الأساسية بنوع دقيق
  const baseNav: NavMainItem[] = [
{
  title: "Management",
  url: "/management",
  icon: BarChart,
  requiredPrivilege: "management.view",
  items: [
    {
      title: "Customers",
      url: "/management/customers",
      requiredPrivilege: "management.customers-view",
    },

    {
      title: "Sales Overview",
      url: "/management/sales",
      requiredPrivilege: "management.sales-view",
    },


    {
      title: "Visa",
      url: "/management/visa",
      requiredPrivilege: "visa.manage",
    },
    
  ],
},


{
  title: "Sales",
  url: "/sales",
  icon: SquareTerminal,
  requiredPrivilege: "sales.view",
  items: [
    {
      title: "Sales Report",
      url: "/sales",
      requiredPrivilege: "sales.view",
    },
    { title: "Customers", url: "/sales/customers", requiredPrivilege: "customers.view" },
        {
      title: "Add Order",
      url: "/sales/add",
      requiredPrivilege: "sales.add",
    },
    {
      title: "Reports",
      url: "/sales/reports",
      requiredPrivilege: "sales.report",
    },
  ],
},
    {
      title: "HR",
      url: "/hr",
      icon: BookOpen,
      requiredPrivilege: "employees.view",
      items: [
        { title: "Dashboard", url: "/hr", requiredPrivilege: "employees.view" },
        { title: "Employees", url: "/hr/employees", requiredPrivilege: "employees.view" },
      ],
    },
    {
  title: "Operations",
  url: "/operations",
  icon: Wrench,
  items: [
    { title: "Dashboard", url: "/operations" },
    { title: "Packages", url: "/operations/packages", requiredPrivilege: "packages.view" },
  ],
},
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      requiredPrivilege: "settings.update",
      items: [
        { title: "General", url: "/settings", requiredPrivilege: "settings.update" },
        { title: "Departments", url: "/settings/departments", requiredPrivilege: "departments.manage" },
        { title: "Privileges", url: "/settings/privileges", requiredPrivilege: "settings.privileges" },
      ],
    },
  ];

  const filteredNav = baseNav.map((section) => ({
    ...section,
    isActive:
      pathname === section.url ||
      section.items?.some((item) => pathname.startsWith(item.url)),
    items: section.items?.map((item) => ({
      ...item,
      isActive: pathname === item.url,
    })),
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <a href="/">
          <TeamSwitcher
            teams={[
              { name: "Arab Tours", logo: GalleryVerticalEnd, plan: "Enterprise" },
              { name: "Acme Corp.", logo: AudioWaveform, plan: "Startup" },
            ]}
          />
        </a>
      </SidebarHeader>

      <SidebarContent>
        {/* ✅ تمرير العناصر بدون أخطاء type */}
        <NavMain items={filteredNav} />

        <NavProjects
          projects={[
            { name: "Design Engineering", url: "#", icon: Frame },
            { name: "Sales & Marketing", url: "#", icon: PieChart },
            { name: "Travel", url: "#", icon: Map },
          ]}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={profile} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}