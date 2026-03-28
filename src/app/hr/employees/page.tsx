import { adminDb } from "@/lib/firebaseAdmin";
import UsersClient from "./emp-clients/page";


export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const snap = await adminDb
    .collection("users")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const employees = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate
      ? d.data().createdAt.toDate().toISOString()
      : null,
  }));

  return <UsersClient employees={employees} />;
}
