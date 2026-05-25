"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/components/import/ImportWizard";

export default function ImportPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6 pb-24 md:pb-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8">
          <Link href="/settings/" aria-label="Назад">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Імпорт з Excel</h1>
          <p className="text-sm text-muted-foreground">
            Аркуші «Витрати YYYY», «Продажі YYYY» — у Firestore
          </p>
        </div>
      </header>

      <ImportWizard />
    </main>
  );
}
