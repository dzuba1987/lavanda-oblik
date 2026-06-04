"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Людські назви розділів за сегментом URL — для breadcrumbs. */
const SECTION_LABELS: Record<string, string> = {
  categories: "Категорії",
  products: "Товари",
  suppliers: "Постачальники",
  customers: "Клієнти",
  import: "Імпорт з Excel",
  notifications: "Сповіщення",
  changelog: "Новини для користувачів",
  users: "Користувачі",
  dev: "Інструменти адміна",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // /settings/changelog/ → ["", "settings", "changelog"]
  const segment = pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  const isRoot = segment === "";

  return (
    <>
      {!isRoot && (
        <nav
          aria-label="Хлібні крихти"
          className="container mx-auto px-4 pt-4"
        >
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link
              href="/settings/"
              className="transition-colors hover:text-foreground"
            >
              Налаштування
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-foreground">
              {SECTION_LABELS[segment] ?? segment}
            </span>
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
