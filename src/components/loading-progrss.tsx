'use client';

import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

export function LoadingProgress() {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-[300px]">
        <Progress value={progress} />
        <p className="text-center mt-2 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
