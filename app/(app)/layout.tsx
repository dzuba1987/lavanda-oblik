"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, authUser, userDoc, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authUser) router.replace("/login/");
  }, [loading, authUser, router]);

  // Поки auth/Firestore читаються — лоадер. Важливо тримати його доки
  // userDoc не підтягнеться (інакше при перемиканні акаунтів між
  // setAuthUser і setUserDoc проскакує флеш кабінету з чужою роллю).
  if (loading || !authUser || !userDoc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  // Тільки явно дозволені ролі бачать кабінет; усе інше — очікування.
  if (userDoc.role !== "admin" && userDoc.role !== "seller") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Очікування доступу</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ваш акаунт розглядає адміністратор. Після підтвердження ви зможете
          увійти і працювати з обліком.
        </p>
        <Button variant="outline" size="sm" onClick={signOut}>
          Вийти
        </Button>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
