import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export function useNotifications(userRole?: string) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((n: any) =>
          n.toUserId === user.uid ||
          (n.toRole && n.toRole === userRole)
        );

      setNotifications(list);
    });

    return () => unsub();
  }, [user, userRole]);

  return notifications;
}