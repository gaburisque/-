"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface FlashToastProps {
  message?: string;
  error?: string;
}

export function FlashToast({ message, error }: FlashToastProps) {
  const router = useRouter();

  useEffect(() => {
    if (message) {
      toast.success(message);
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
    if (error) {
      toast.error(error);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
  }, [message, error, router]);

  return null;
}
