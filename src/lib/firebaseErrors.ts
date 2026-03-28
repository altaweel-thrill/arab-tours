// lib/firebaseErrors.ts
export function getAuthErrorMessage(code: string): string {
  const errors: Record<string, string> = {
    "auth/invalid-email": "The email address is not valid.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests": "Too many failed attempts. Please wait a moment.",
  };

  return errors[code] || "Something went wrong. Please try again.";
}
