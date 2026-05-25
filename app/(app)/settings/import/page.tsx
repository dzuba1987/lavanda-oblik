"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8">
          <Link href="/settings/" aria-label="Назад">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Імпорт з Excel</h1>
          <p className="text-sm text-muted-foreground">
            Завантаження історичних даних з .xlsx
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Скоро з&apos;явиться</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Парсер аркушів «Витрати», «Продажі» та «Словник» — у задачі #9.
        </CardContent>
      </Card>
    </main>
  );
}
