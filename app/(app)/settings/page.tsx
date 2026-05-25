"use client";

import Link from "next/link";
import {
  Tag,
  Package,
  Truck,
  Users,
  Upload,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/settings/categories/",
    label: "Категорії",
    description: "Доходи та витрати",
    icon: Tag,
  },
  {
    href: "/settings/products/",
    label: "Товари",
    description: "Прайс-лист продукції",
    icon: Package,
  },
  {
    href: "/settings/suppliers/",
    label: "Постачальники",
    description: "Магазини, агровіни, тощо",
    icon: Truck,
  },
  {
    href: "/settings/customers/",
    label: "Клієнти",
    description: "Покупці продукції",
    icon: Users,
  },
  {
    href: "/settings/import/",
    label: "Імпорт з Excel",
    description: "Завантажити .xlsx з історією",
    icon: Upload,
  },
];

export default function SettingsPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Налаштування</h1>
        <p className="text-sm text-muted-foreground">
          Довідники, імпорт даних, профіль
        </p>
      </header>

      <Card>
        <CardContent className="divide-y p-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.description}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
