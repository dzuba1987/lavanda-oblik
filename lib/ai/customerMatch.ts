import Fuse from "fuse.js";
import type { Customer } from "@/lib/data/types";
import type { ParsedCustomerCandidate } from "./types";

/**
 * Fuzzy-матчинг сирого імені (з фрази "Олі", "для Вінниці") до існуючих клієнтів.
 * Повертає топ-N кандидатів. Score 0..1, менше = краще (особливість Fuse.js).
 *
 * Threshold 0.45 — компроміс між точністю та recall'ом: пускає "Олі" → "Олі
 * Хімічки мама", але відсіює зовсім інших.
 */
export function matchCustomers(
  rawName: string | null,
  customers: Customer[],
  topN = 3
): ParsedCustomerCandidate[] {
  if (!rawName || customers.length === 0) return [];
  const trimmed = rawName.trim();
  if (!trimmed) return [];

  const fuse = new Fuse(customers, {
    keys: ["name"],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(trimmed, { limit: topN });
  return results.map((r) => ({
    id: r.item.id,
    name: r.item.name,
    score: r.score ?? 1,
  }));
}
