// src/components/nav-main.tsx
"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";

// ✅ النوع المصدَّر حتى يستخدم في AppSidebar
export type NavMainItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  requiredPrivilege?: string;
  items?: {
    title: string;
    requiredPrivilege?: string;
    url: string;
  }[];
};

export function NavMain({ items }: { items: NavMainItem[] }) {
  const { privileges } = useAuth();

  const canView = (key?: string) =>
    !key || privileges?.[key] === true;

  const filteredItems = items
    .map((item) => {
      const visibleSubItems =
        item.items?.filter((sub) => canView(sub.requiredPrivilege)) || [];
      if (!canView(item.requiredPrivilege) && visibleSubItems.length === 0)
        return null;
      return { ...item, items: visibleSubItems };
    })
    .filter((i): i is { 
      title: string;
      url: string;
      icon?: LucideIcon;
      isActive?: boolean;
      requiredPrivilege?: string;
      items: { title: string; requiredPrivilege?: string; url: string; }[];
    } => i !== null);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {filteredItems.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.items && item.items.length > 0 && (
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>

              {item.items && item.items.length > 0 && (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={sub.url}>
                            <span>{sub.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              )}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}