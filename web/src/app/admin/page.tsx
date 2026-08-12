"use client";

// Purpose: /admin entry — send Super Admins to dashboard; everyone else to login.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AdminIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user?.role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b1c24] text-white/70">
      Redirecting…
    </main>
  );
}
