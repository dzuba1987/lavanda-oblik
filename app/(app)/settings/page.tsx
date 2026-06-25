"use client";

import Link from "next/link";
import {
  Tag,
  Package,
  Truck,
  Users,
  Upload,
  ChevronRight,
  FlaskConical,
  UserCog,
  BellRing,
  Megaphone,
  HelpCircle,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";

type Section = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const BASE_SECTIONS: Section[] = [
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
  {
    href: "/settings/notifications/",
    label: "Сповіщення",
    description: "Telegram-бот для замовлень і нових юзерів",
    icon: BellRing,
  },
  {
    href: "/settings/weather/",
    label: "Погода",
    description: "Провайдер прогнозу для календаря фотосесій",
    icon: Cloud,
  },
  {
    href: "/help/",
    label: "Довідка",
    description: "Як користуватись додатком: замовлення, фінанси, налаштування",
    icon: HelpCircle,
  },
];

const ADMIN_SECTION: Section = {
  href: "/settings/users/",
  label: "Користувачі",
  description: "Список акаунтів та керування ролями",
  icon: UserCog,
};

const CHANGELOG_SECTION: Section = {
  href: "/settings/changelog/",
  label: "Новини для користувачів",
  description: "Розсилка «що нового» всім у Telegram",
  icon: Megaphone,
};

const DEV_SECTION: Section = {
  href: "/settings/dev/",
  label: "Інструменти адміна",
  description: "Стандартні довідники + dev-сід",
  icon: FlaskConical,
};

export default function SettingsPage() {
  const { userDoc } = useAuth();
  const isAdmin = userDoc?.role === "admin";

  const sections: Section[] = [...BASE_SECTIONS];
  if (isAdmin) sections.push(ADMIN_SECTION);
  if (isAdmin) sections.push(CHANGELOG_SECTION);
  if (isAdmin) sections.push(DEV_SECTION);

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
          {sections.map((s) => {
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
