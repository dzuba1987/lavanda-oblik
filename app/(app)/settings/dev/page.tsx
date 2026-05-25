"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { removeSeedData, seedTestData } from "@/lib/data/seed";

const IS_DEV = process.env.NODE_ENV === "development";

export default function DevSettingsPage() {
  const router = useRouter();
  const { authUser, userDoc, loading } = useAuth();
  const [busy, setBusy] = useState<"seed" | "remove" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const allowed = IS_DEV && userDoc?.role === "admin";

  useEffect(() => {
    if (!loading && !allowed) router.replace("/settings/");
  }, [loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  async function handleSeed() {
    if (!authUser) return;
    setBusy("seed");
    setLastResult(null);
    try {
      const counts = await seedTestData(authUser.uid);
      const msg = `Створено: категорій ${counts.categories}, товарів ${counts.products}, постачальників ${counts.suppliers}, клієнтів ${counts.customers}, транзакцій ${counts.transactions}, замовлень ${counts.orders}`;
      setLastResult(msg);
      toast.success("Тестові дані створено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Помилка під час сіду");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!confirm("Видалити всі записи з прапором seed: true? Це не зачепить реальних даних.")) return;
    setBusy("remove");
    setLastResult(null);
    try {
      const counts = await removeSeedData();
      const msg = `Видалено: категорій ${counts.categories}, товарів ${counts.products}, постачальників ${counts.suppliers}, клієнтів ${counts.customers}, транзакцій ${counts.transactions}, замовлень ${counts.orders}`;
      setLastResult(msg);
      toast.success("Тестові дані видалено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Помилка під час видалення");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Розробник</h1>
        <p className="text-sm text-muted-foreground">
          Інструменти для перегляду функціоналу. Доступно тільки в dev-режимі.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Тестові дані</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Створює довідники (категорії, товари, постачальники, клієнти) та ~260
            транзакцій за останні 180 днів. Усі записи мають поле
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">seed: true</code>
            — кнопка «Видалити» прибере рівно їх, не зачіпаючи реальних.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSeed}
              disabled={busy !== null}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {busy === "seed" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Сідувати тестові дані
            </Button>

            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={busy !== null}
            >
              {busy === "remove" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Видалити тестові дані
            </Button>
          </div>

          {lastResult && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              {lastResult}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
