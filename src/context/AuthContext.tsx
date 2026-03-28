"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type AuthContextType = {
  user: User | null;
  role: string | null;
  privileges: Record<string, boolean>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  privileges: {},
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [privileges, setPrivileges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole(data.role || null);
            setPrivileges(data.privileges || {});
          }
        } catch (err) {
          console.error("Error loading privileges:", err);
        }
      } else {
        setUser(null);
        setRole(null);
        setPrivileges({});
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, privileges, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
