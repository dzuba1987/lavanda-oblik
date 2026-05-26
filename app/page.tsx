"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Home() {
  const router = useRouter();
  const { loading, authUser } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!authUser) return;
    // Залогіненого юзера не тримаємо на лендингу — одразу в робочу зону.
    // На мобільному частіше створюють замовлення → orders, desktop → dashboard.
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    router.replace(isMobile ? "/orders/" : "/dashboard/");
  }, [loading, authUser, router]);

  if (loading || authUser) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 px-6 py-16 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl shadow-lg"
        />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          ЛавандаОблік
        </h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          Облік витрат і продажів Лавандового поля — на телефоні та в браузері.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-700">
            <Link href="/login/">Увійти</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
