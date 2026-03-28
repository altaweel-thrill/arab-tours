"use client";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { redirect } from "next/navigation";
import { LoadingProgress } from "./loading-progrss";

export default function Protected({
  children,
  requiredAnyOf,
}: {
  children: ReactNode;
  requiredAnyOf?: string[]; // أمثلة: ["admin"] أو ["projects.read","admin"]
}) {
  const { user, loading, role, privileges } = useAuth();
  if (loading) return <LoadingProgress />;
  if (!user) redirect("/login");

  if (requiredAnyOf && requiredAnyOf.length) {
    const ok =
      requiredAnyOf.some((r) => r === role) ||
      requiredAnyOf.some((p) => privileges.includes(p));
    if (!ok) return <div className="p-6">Don't have permission.</div>;
  }

  return <>{children}</>;
}
