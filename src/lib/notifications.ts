import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  url: string
) {
  await addDoc(collection(db, "notifications", userId, "items"), {
    title,
    message,
    url,
    isRead: false,
    createdAt: Timestamp.now(),
  });
}