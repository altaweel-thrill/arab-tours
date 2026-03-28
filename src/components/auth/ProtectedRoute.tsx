'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LoadingProgress } from '../loading-progrss';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 🔒 إذا انتهى التحميل والمستخدم غير مسجل دخول → إعادة توجيه
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ⏳ أثناء التحقق من تسجيل الدخول
  if (loading || !user) {
    return (
      <LoadingProgress />
    );
  }

  // ✅ المستخدم مسجل الدخول
  return <>{children}</>;
}
