"use client"
import { GalleryVerticalEnd } from "lucide-react"
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/login-form"
import { useRouter } from "next/navigation";
import { LoadingProgress } from "@/components/loading-progrss";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth(false); // don't auto-redirect in hook

  // ✅ Redirect only after component mounts
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) return <LoadingProgress />;
  
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className=" text-primary-foreground flex size-7 items-center justify-center ">
             <img className="rounded-md shadow-md" src="./arab-tours.png" alt="Arab Tours" />
            </div>
            Arab Tours
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="./arab-tours.png"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  )
}
