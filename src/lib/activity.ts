import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ActivityInput = {
  customerId: string;
  type: "created" | "updated" | "assigned" | "status_changed";
  title: string;
  by: string;
  byName: string;
  description?: string;
  meta?: Record<string, any>;
};

export async function addCustomerActivity(input: ActivityInput) {
  await addDoc(collection(db, "customerActivities"), {
    ...input,
    createdAt: serverTimestamp(),
  });
}