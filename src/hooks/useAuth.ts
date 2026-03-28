"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export function useAuth(redirectIfUnauthed = true) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        if (redirectIfUnauthed) router.replace("/login");
      }
      setLoading(false);
    });

    return () => unsub();
  }, [router, redirectIfUnauthed]);

  return { user, loading ,setLoading};
}
