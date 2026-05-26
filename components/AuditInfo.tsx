"use client";

import { History, Pencil } from "lucide-react";
import { formatDateLong, formatRelative } from "@/lib/utils/format";
import type { AuditFields } from "@/lib/data/types";

/**
 * Невеликий блок під формою редагування — показує "хто створив" та "хто
 * востаннє редагував" з відносним часом. Старі записи без audit-полів
 * нічого не показують.
 */
export function AuditInfo({ item }: { item: AuditFields | null | undefined }) {
  if (!item) return null;
  const createdName = item.createdByName ?? null;
  const createdAt = item.createdAt ?? null;
  const updatedName = item.updatedByName ?? null;
  const updatedAt = item.updatedAt ?? null;

  // Чи були правки після створення (різні timestamps) — показуємо обидва рядки.
  // Інакше тільки створення.
  const hasUpdate =
    !!updatedAt &&
    !!createdAt &&
    updatedAt.toMillis() - createdAt.toMillis() > 1000;

  if (!createdName && !createdAt) return null;

  return (
    <div className="mt-2 space-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 shrink-0" />
        <span>
          Створено <b className="text-foreground">{createdName ?? "—"}</b>
          {createdAt && (
            <>
              {" · "}
              <span title={formatDateLong(createdAt)}>
                {formatRelative(createdAt)}
              </span>
            </>
          )}
        </span>
      </div>
      {hasUpdate && (
        <div className="flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>
            Оновлено <b className="text-foreground">{updatedName ?? "—"}</b>
            {updatedAt && (
              <>
                {" · "}
                <span title={formatDateLong(updatedAt)}>
                  {formatRelative(updatedAt)}
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
