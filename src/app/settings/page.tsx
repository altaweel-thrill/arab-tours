"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

export default function GeneralSettingsPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [language, setLanguage] = useState("en")

  return (
    <ProtectedRoute>
       <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                   Home page
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {/* <BreadcrumbSeparator className="hidden md:block" /> */}
                {/* <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem> */}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="ml-auto px-4">
            <ThemeToggle />
          </div>
        </header>
       <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">General Settings</h1>

      {/* System Info */}
      <Card className="w-full md:w-1/2">
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 width-half">
            <Label htmlFor="company">Company Name</Label>
            <Input className="w-64" id="company" placeholder="Enter company name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Support Email</Label>
            <Input className="w-64" id="email" placeholder="support@company.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input className="w-64" id="phone" placeholder="+1 234 567 890" />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme">Dark Mode</Label>
            <Switch id="theme" checked={darkMode} onCheckedChange={setDarkMode} />
          </div>

          <div className="grid gap-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-4">
            <Button>Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRoute>


    
  )
}
