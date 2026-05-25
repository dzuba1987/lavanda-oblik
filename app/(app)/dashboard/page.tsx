"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";

export default function DashboardPage() {
  const { userDoc } = useAuth();

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          Вітаємо{userDoc?.name ? `, ${userDoc.name}` : ""}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Скоро з&apos;явиться</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>KPI картки, графіки доходів/витрат, топ-товари — у задачі #7.</p>
        </CardContent>
      </Card>
    </main>
  );
}
