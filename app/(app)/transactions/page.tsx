"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TransactionsPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Транзакції</h1>
        <p className="text-sm text-muted-foreground">
          Доходи та витрати, фільтри по періодах і категоріях
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Скоро з&apos;явиться</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          CRUD транзакцій з фільтрами — у задачі #6.
        </CardContent>
      </Card>
    </main>
  );
}
