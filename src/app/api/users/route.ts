export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, email, password, phone, department, role, photoURL } =
      await req.json();

    // ✅ Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone || undefined,
      photoURL: photoURL || undefined,
    });

    // ✅ Save user data in Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phone,
      department,
      role,
      status: "active",
      privileges: [],
      photoURL: photoURL || "",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      message: "User created successfully",
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 400 }
    );
  }
}
