"use client";
import { useAuth } from "@/context/AuthContext";

export function usePrivilege(key: string) {
  const { privileges } = useAuth();
  return privileges?.[key] ?? false;
}
