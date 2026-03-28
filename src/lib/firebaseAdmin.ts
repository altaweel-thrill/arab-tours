import * as admin from "firebase-admin";

// 🧩 Check if the app is already initialized to avoid duplication
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("❌ Missing Firebase Admin environment variables.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("🔥 Firebase Admin initialization failed:", error);
  }
}

// 🔐 Export reusable admin SDK services
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
