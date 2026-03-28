"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlusCircle, Trash2 } from "lucide-react";
import ProtectedRouteWithPrivilege from "@/components/auth/protected-route-with-privilege";

export default function AddPackagePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [packageData, setPackageData] = useState({
    name: "",
    destination: "",
    duration: "",
    price: "",
    persons: "",
    description: "",
    status: "active",
  });

  const [services, setServices] = useState<{ type: string; details: string }[]>([
    { type: "", details: "" },
  ]);

  const handleAddService = () => {
    setServices([...services, { type: "", details: "" }]);
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, key: string, value: string) => {
    const updated = [...services];
    (updated[index] as any)[key] = value;
    setServices(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageData.name || !packageData.destination || !packageData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "packages"), {
        ...packageData,
        duration: Number(packageData.duration) || 0,
        price: Number(packageData.price) || 0,
        persons: Number(packageData.persons) || 1,
        services,
        createdAt: serverTimestamp(),
      });

      toast.success("Package added successfully!");
      router.push("/operations/packages");
    } catch (error) {
      console.error("Error adding package:", error);
      toast.error("Failed to add package");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRouteWithPrivilege requiredPrivilege="packages.add">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-16 items-center gap-2 border-b bg-background/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/operations">Operations</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Add Package</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          {/* CONTENT */}
          <div className="p-6 bg-muted/10 min-h-screen">
            <Card className="max-w-4xl shadow-md border rounded-2xl">
              <CardHeader>
                <CardTitle>Add New Package</CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="my-2">Name</Label>
                      <Input
                        placeholder="Package name"
                        value={packageData.name}
                        onChange={(e) =>
                          setPackageData({ ...packageData, name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label className="my-2">Destination</Label>
                      <Input
                        placeholder="e.g. Dubai, UAE"
                        value={packageData.destination}
                        onChange={(e) =>
                          setPackageData({
                            ...packageData,
                            destination: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label className="my-2">Duration (days)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 5"
                        value={packageData.duration}
                        onChange={(e) =>
                          setPackageData({
                            ...packageData,
                            duration: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label className="my-2">Price (SAR)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2500"
                        value={packageData.price}
                        onChange={(e) =>
                          setPackageData({
                            ...packageData,
                            price: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label className="my-2">Number of Persons</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2"
                        value={packageData.persons}
                        onChange={(e) =>
                          setPackageData({
                            ...packageData,
                            persons: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="my-2">Description</Label>
                    <Textarea
                      placeholder="Write a short description about this package..."
                      value={packageData.description}
                      onChange={(e) =>
                        setPackageData({
                          ...packageData,
                          description: e.target.value,
                        })
                      }
                      rows={4}
                    />
                  </div>

                  <Separator />

                  {/* Services */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="my-2">Included Services</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddService}
                      >
                        <PlusCircle className="w-4 h-4 mr-1" /> Add Service
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {services.map((service, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center"
                        >
                          <Input
                            placeholder="Service type (e.g. flight, hotel)"
                            value={service.type}
                            onChange={(e) =>
                              handleServiceChange(index, "type", e.target.value)
                            }
                          />
                          <div className="flex gap-2">
                            <Input
                              placeholder="Details"
                              value={service.details}
                              onChange={(e) =>
                                handleServiceChange(index, "details", e.target.value)
                              }
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => handleRemoveService(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save Package"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRouteWithPrivilege>
  );
}