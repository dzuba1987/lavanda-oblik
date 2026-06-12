"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  Warehouse,
  BarChart3,
  Settings,
  LogOut,
  HelpCircle,
  Camera,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNewOrdersCount } from "@/lib/data/useNewOrdersCount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof LayoutDashboard;
};

const NAV: NavItem[] = [
  { href: "/dashboard/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/transactions/", label: "Транзакції", icon: Receipt },
  { href: "/orders/", label: "Замовлення", shortLabel: "Замовл.", icon: ClipboardList },
  { href: "/bookings/", label: "Фотосесії", shortLabel: "Фото", icon: Camera },
  { href: "/inventory/", label: "Мій Склад", shortLabel: "Склад", icon: Warehouse },
  { href: "/analytics/", label: "Аналітика", icon: BarChart3 },
  { href: "/settings/", label: "Налаштування", shortLabel: "Меню", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileHeader />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const newOrdersCount = useNewOrdersCount();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg"
        />
        <span className="font-semibold tracking-tight">ЛавандаОблік</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          const showBadge =
            item.href === "/orders/" && newOrdersCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {showBadge && <NewOrdersBadge n={newOrdersCount} />}
            </Link>
          );
        })}
        <Link
          href="/help/"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, "/help/")
              ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Довідка</span>
        </Link>
      </nav>

      <div className="border-t p-3">
        <ProfileMenu align="start" />
      </div>
    </aside>
  );
}

function HelpButton() {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label="Довідка"
      title="Довідка"
    >
      <Link href="/help/">
        <HelpCircle className="h-5 w-5" />
      </Link>
    </Button>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-md"
        />
        <span className="font-semibold tracking-tight">ЛавандаОблік</span>
      </div>
      <div className="flex items-center gap-1">
        <HelpButton />
        <ProfileMenu align="end" compact />
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const newOrdersCount = useNewOrdersCount();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center border-t bg-card/95 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const showBadge =
          item.href === "/orders/" && newOrdersCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px]",
              active
                ? "text-violet-600 dark:text-violet-400"
                : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <Icon className={cn("h-5 w-5", active && "scale-110 transition-transform")} />
              {showBadge && (
                <span className="absolute -right-2 -top-1.5">
                  <NewOrdersBadge n={newOrdersCount} compact />
                </span>
              )}
            </span>
            <span className="max-w-full truncate">
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function NewOrdersBadge({ n, compact }: { n: number; compact?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex",
        compact ? "" : "ml-auto"
      )}
      aria-label={`${n} нових замовлень`}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-70" />
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-red-500 font-semibold tabular-nums text-white shadow",
          compact
            ? "h-4 min-w-[1rem] px-1 text-[10px]"
            : "h-5 min-w-[1.25rem] px-1.5 text-[11px]"
        )}
      >
        {n}
      </span>
    </span>
  );
}

function ProfileMenu({
  align,
  compact,
}: {
  align: "start" | "end";
  compact?: boolean;
}) {
  const { authUser, userDoc, signOut } = useAuth();
  const initials = (userDoc?.name ?? authUser?.email ?? "?")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 w-full justify-start gap-3 px-2",
            compact && "w-auto"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
            {initials || <UserIcon className="h-4 w-4" />}
          </div>
          {!compact && (
            <div className="flex min-w-0 flex-col items-start">
              <span className="truncate text-sm font-medium">
                {userDoc?.name ?? authUser?.email}
              </span>
              <span className="text-xs text-muted-foreground">
                {userDoc?.role ?? "—"}
              </span>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{authUser?.email}</span>
          <Badge
            variant={userDoc?.role === "admin" ? "default" : "secondary"}
            className="mt-1 w-fit"
          >
            {userDoc?.role ?? "—"}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} variant="destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Вийти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const normalized = pathname.endsWith("/") ? pathname : pathname + "/";
  return normalized === href || normalized.startsWith(href);
}
