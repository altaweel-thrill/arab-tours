"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, updateDoc, doc } from "firebase/firestore";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export default function NotificationsBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "notifications", userId, "items"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [userId]);

  const unread = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", userId, "items", id), {
      isRead: true,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-md p-0"
        >
          <Bell className="h-5 w-5" />

          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1 rounded-full">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        className="w-80 p-3 rounded-xl shadow-xl border bg-white dark:bg-neutral-900"
      >
        <h3 className="font-semibold mb-2">Notifications</h3>

        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications</p>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 6).map((n) => (
              <Link
                key={n.id}
                href={n.url || "#"}
                className="block p-2 rounded hover:bg-accent transition"
                onClick={() => markAsRead(n.id)}
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </Link>
            ))}
          </div>
        )}

        <Link
          href="/notifications"
          className="block text-center text-blue-600 dark:text-blue-400 text-sm font-medium mt-2"
        >
          View All
        </Link>
      </PopoverContent>
    </Popover>
  );
}