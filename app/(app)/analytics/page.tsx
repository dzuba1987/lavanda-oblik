"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Аналітика</h1>
        <p className="text-sm text-muted-foreground">
          Динаміка, сезонність, маржа, топ постачальники й клієнти
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Скоро з&apos;явиться</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Детальні графіки — у задачі #8.
        </CardContent>
      </Card>
    </main>
  );
}
