import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 px-6 py-16 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg">
          <Sprout className="h-9 w-9" />
        </div>
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
