'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LoadingProgress } from '../loading-progrss';
import { toast } from 'sonner';

interface ProtectedRouteWithPrivilegeProps {
  children: ReactNode;
  requiredPrivilege?: string; // privilege key like "employees.add"
  fallbackPath?: string; // default: "/"
}

export default function ProtectedRouteWithPrivilege({
  children,
  requiredPrivilege,
  fallbackPath = '/',
}: ProtectedRouteWithPrivilegeProps) {
  const { user, loading, privileges } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // 🧩 لم يسجل الدخول
      if (!user) {
        router.push('/login');
        toast.error('Please log in to access this page.');
        return;
      }

      // 🔒 لا يملك الصلاحية المطلوبة
      if (requiredPrivilege && !privileges?.[requiredPrivilege]) {
        toast.error('You do not have permission to access this page.');
        router.push(fallbackPath);
      }
    }
  }, [user, loading, privileges, requiredPrivilege, fallbackPath, router]);

  // ⏳ أثناء التحقق
  if (loading || !user) {
    return <LoadingProgress />;
  }

  // 🔑 التحقق من الصلاحية
  if (requiredPrivilege && !privileges?.[requiredPrivilege]) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You don’t have permission to view this page.
      </div>
    );
  }

  // ✅ المستخدم مسموح له بالدخول
  return <>{children}</>;
}
