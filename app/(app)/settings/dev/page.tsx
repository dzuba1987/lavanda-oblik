"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookText, Loader2, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { removeSeedData, seedTestData } from "@/lib/data/seed";
import { applyDictionaries } from "@/lib/data/dictionaries";
import {
  findCustomerDuplicates,
  mergeCustomerDuplicates,
  type DuplicateGroup,
} from "@/lib/data/dedupeCustomers";

const IS_DEV = process.env.NODE_ENV === "development";

export default function DevSettingsPage() {
  const router = useRouter();
  const { authUser, userDoc, loading } = useAuth();
  const [busy, setBusy] = useState<
    "seed" | "remove" | "dict" | "dupePreview" | "dupeMerge" | null
  >(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [dupeGroups, setDupeGroups] = useState<DuplicateGroup[] | null>(null);

  // Сторінка для адмінів. Тестові дані доступні тільки в dev,
  // але стандартні довідники — production-safe upsert.
  const allowed = userDoc?.role === "admin";

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

  async function handleApplyDictionaries() {
    setBusy("dict");
    setLastResult(null);
    try {
      const r = await applyDictionaries();
      const msg =
        `Категорії: додано ${r.categoriesAdded}, пропущено ${r.categoriesSkipped}. ` +
        `Товари: додано ${r.productsAdded}, пропущено ${r.productsSkipped}.`;
      setLastResult(msg);
      toast.success("Довідники оновлено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Помилка під час оновлення");
    } finally {
      setBusy(null);
    }
  }

  async function handleDupePreview() {
    setBusy("dupePreview");
    setLastResult(null);
    try {
      const groups = await findCustomerDuplicates();
      setDupeGroups(groups);
      const dupes = groups.reduce((n, g) => n + g.duplicates.length, 0);
      if (groups.length === 0) {
        toast.success("Дублів не знайдено");
      } else {
        toast.success(`Груп: ${groups.length}, дублів на видалення: ${dupes}`);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Помилка під час пошуку дублів");
    } finally {
      setBusy(null);
    }
  }

  async function handleDupeMerge() {
    const dupes = (dupeGroups ?? []).reduce(
      (n, g) => n + g.duplicates.length,
      0
    );
    if (
      !confirm(
        `Злити ${dupes} дубль(ів) у ${dupeGroups?.length ?? 0} груп(и)?\n\n` +
          "Посилання в замовленнях, фотосесіях і транзакціях перепишуться на " +
          "канонічного клієнта, дублі буде ВИДАЛЕНО. Дію не можна скасувати."
      )
    )
      return;
    setBusy("dupeMerge");
    setLastResult(null);
    try {
      const r = await mergeCustomerDuplicates();
      const msg =
        `Злито груп: ${r.groups}. Видалено клієнтів: ${r.customersRemoved}. ` +
        `Перепризначено — замовлень: ${r.ordersReassigned}, ` +
        `фотосесій: ${r.bookingsReassigned}, транзакцій: ${r.transactionsReassigned}.`;
      setLastResult(msg);
      setDupeGroups(null);
      toast.success("Дублі злито");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Помилка під час злиття");
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
          Інструменти для адмінів. Стандартні довідники — production-safe;
          секція з тестовими даними доступна лише в dev-режимі.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Стандартні довідники Лаванди</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Завантажує реальний словник з обліку: <b>8 категорій-доходів</b>,
            <b> 36 категорій-витрат</b> і <b>24 товари/послуги</b>. Дублі за
            назвою пропускаються — кнопку можна тиснути багато разів.
            Стартові ціни товарів — <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">null</code>,
            бо у Словнику цін немає; задавати окремо за потреби.
          </p>

          <Button
            onClick={handleApplyDictionaries}
            disabled={busy !== null}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {busy === "dict" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookText className="mr-2 h-4 w-4" />
            )}
            Завантажити стандартні довідники
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Дублі клієнтів</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Знаходить клієнтів з однаковим іменем (без урахування регістру та
            зайвих пробілів), обирає канонічного (найбільше заповнених полів),
            зливає в нього порожні поля з дублів, перепризначає посилання в{" "}
            <b>замовленнях</b>, <b>фотосесіях</b> і <b>транзакціях</b>, а дублі
            видаляє. Спочатку натисніть «Показати дублі», перевірте список, потім
            «Злити». Дія незворотна.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleDupePreview}
              disabled={busy !== null}
            >
              {busy === "dupePreview" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Users className="mr-2 h-4 w-4" />
              )}
              Показати дублі
            </Button>

            {dupeGroups && dupeGroups.length > 0 && (
              <Button
                onClick={handleDupeMerge}
                disabled={busy !== null}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {busy === "dupeMerge" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Злити {dupeGroups.reduce((n, g) => n + g.duplicates.length, 0)}{" "}
                дубль(ів)
              </Button>
            )}
          </div>

          {dupeGroups && dupeGroups.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
              {dupeGroups.map((g) => (
                <div key={g.key} className="border-b pb-2 last:border-0">
                  <div className="font-medium">
                    ✓ {g.canonical.name}
                    {g.canonical.phone ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {g.canonical.phone}
                      </span>
                    ) : null}
                  </div>
                  <div className="pl-4 text-muted-foreground">
                    {g.duplicates.map((d) => (
                      <div key={d.id}>
                        + {d.name}
                        {d.phone ? ` (${d.phone})` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {IS_DEV ? (
        <>
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
        </CardContent>
      </Card>
        </>
      ) : null}

      {lastResult && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          {lastResult}
        </div>
      )}
    </main>
  );
}
