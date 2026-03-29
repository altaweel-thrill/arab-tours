"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

type ProtectedProps = {
  children: React.ReactNode;
  requiredAnyOf?: string[];
};

export default function Protected({
  children,
  requiredAnyOf = [],
}: ProtectedProps) {
  const { role, privileges, loading } = useAuth();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const safePrivileges: string[] = Array.isArray(privileges)
    ? privileges.filter((item): item is string => typeof item === "string")
    : [];

  if (requiredAnyOf.length > 0) {
    const ok =
      requiredAnyOf.some((r) => r === role) ||
      requiredAnyOf.some((p) => safePrivileges.includes(p));

    if (!ok) {
      return <div className="p-6">Don't have permission.</div>;
    }
  }

  return <>{children}</>;
}