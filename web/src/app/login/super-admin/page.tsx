"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Alias — canonical Super Admin login is /admin/login. */
export default function SuperAdminLoginAlias() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/login");
  }, [router]);
  return (
    <main className="grid min-h-screen place-items-center bg-[#0b1c24] text-white/70">
      Redirecting…
    </main>
  );
}
