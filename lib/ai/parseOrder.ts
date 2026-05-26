import type { Category, Customer, Product } from "@/lib/data/types";
import { getOrderParserModel } from "./firebase";
import { matchCustomers } from "./customerMatch";
import type {
  ParsedDelivery,
  ParsedItem,
  ParsedOrder,
} from "./types";

type GeminiOrderResponse = {
  customerName: string | null;
  items: Array<{
    productName: string;
    categoryName: string;
    quantity: number;
    unitPrice: number;
  }>;
  delivery?: {
    method: string | null;
    cost?: number | null;
    paidBy?: "customer" | "us" | null;
    trackingNumber?: string | null;
    address?: string | null;
  } | null;
  notes?: string | null;
};

/**
 * Парсить голосовий транскрипт у структуру замовлення через Gemini, потім
 * post-обробляє: матчить категорії/товари по id з довідників, fuzzy-матчить
 * клієнта проти існуючих.
 */
export async function parseOrderTranscript(
  transcript: string,
  dicts: {
    categories: Category[];
    products: Product[];
    customers: Customer[];
  }
): Promise<ParsedOrder> {
  const prompt = buildPrompt(transcript, dicts.categories, dicts.products);
  const model = getOrderParserModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let raw: GeminiOrderResponse;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Gemini повернув невалідний JSON: ${text.slice(0, 200)}…`
    );
  }

  const items: ParsedItem[] = (raw.items ?? []).map((it) => {
    const cat = findCategoryByName(it.categoryName, dicts.categories);
    const prod = findProductByName(it.productName, dicts.products);
    return {
      productName: it.productName,
      productId: prod?.id ?? null,
      categoryName: cat?.name ?? it.categoryName,
      categoryId: cat?.id ?? null,
      quantity: it.quantity > 0 ? it.quantity : 1,
      unitPrice: it.unitPrice >= 0 ? it.unitPrice : 0,
    };
  });

  const delivery: ParsedDelivery | null = raw.delivery
    ? {
        method: (raw.delivery.method as ParsedDelivery["method"]) ?? null,
        cost: raw.delivery.cost ?? null,
        paidBy: raw.delivery.paidBy ?? null,
        trackingNumber: raw.delivery.trackingNumber ?? null,
        address: raw.delivery.address ?? null,
      }
    : null;

  return {
    transcript,
    customerName: raw.customerName ?? null,
    customerCandidates: matchCustomers(raw.customerName, dicts.customers),
    items,
    delivery,
    notes: raw.notes ?? null,
  };
}

function buildPrompt(
  transcript: string,
  categories: Category[],
  products: Product[]
): string {
  const incomeCategories = categories.filter((c) => c.type === "income");
  const catList = incomeCategories.map((c) => `- ${c.name}`).join("\n");
  const productList = products
    .slice(0, 200)
    .map(
      (p) =>
        `- ${p.name}${p.defaultPrice ? ` (${p.defaultPrice} грн)` : ""}`
    )
    .join("\n");

  return `Ти парсиш голосовий запис українською мовою про замовлення в магазині квітів та саджанців у структурований JSON.

ФРАЗА КОРИСТУВАЧА:
"""
${transcript}
"""

ДОСТУПНІ КАТЕГОРІЇ (income):
${catList}

ТОВАРИ В ДОВІДНИКУ (для матчингу productName — підбирай найближче за змістом):
${productList}

ПРАВИЛА:
1. customerName — витягни рівно як озвучили ("Олі", "для Вінниці", "замовлення Анна"). Не вгадуй прізвища, які не озвучили. null якщо не згадано.
2. items — кожен товар окремо. quantity якщо не озвучено — 1.
3. unitPrice — за одиницю; якщо озвучено загальну суму ("два варення за 200") — порахуй сам (100). Якщо ціна не озвучена — 0.
4. categoryName — підбери НАЙБЛИЖЧУ з списку категорій вище. Не вигадуй нові.
5. productName — використай ту з довідника якщо очевидний матч, інакше — як озвучили.
6. delivery — заповнюй ТІЛЬКИ якщо явно згадано доставку. Інакше null. paidBy:"customer" якщо озвучено "плюс доставка X грн" (клієнт доплачує). paidBy:"us" якщо "відправили за свій рахунок".
7. notes — лише те що не вмістилось у інші поля (особливі побажання, дата готовності, тощо).

Поверни ЛИШЕ JSON за схемою — без markdown-обгорток.`;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCategoryByName(
  name: string,
  categories: Category[]
): Category | null {
  const n = normalizeName(name);
  return (
    categories.find((c) => normalizeName(c.name) === n) ??
    categories.find((c) => normalizeName(c.name).includes(n)) ??
    categories.find((c) => n.includes(normalizeName(c.name))) ??
    null
  );
}

function findProductByName(name: string, products: Product[]): Product | null {
  const n = normalizeName(name);
  return (
    products.find((p) => normalizeName(p.name) === n) ??
    products.find((p) => normalizeName(p.name).includes(n)) ??
    products.find((p) => n.includes(normalizeName(p.name))) ??
    null
  );
}
