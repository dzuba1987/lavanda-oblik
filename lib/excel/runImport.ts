import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { DEFAULT_CATEGORY_COLORS } from "@/lib/data/categories";
import type {
  Category,
  Customer,
  Product,
  Supplier,
  TransactionType,
} from "@/lib/data/types";
import type { ParsedRow } from "./types";

export type ImportProgress = {
  phase: "dicts" | "transactions" | "done";
  written: number;
  total: number;
  message?: string;
};

export type ImportSummary = {
  transactionsCreated: number;
  categoriesCreated: number;
  productsCreated: number;
  suppliersCreated: number;
  customersCreated: number;
};

const BATCH_LIMIT = 450; // запас від ліміту Firestore (500)

export async function runImport(
  rows: ParsedRow[],
  uid: string,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    transactionsCreated: 0,
    categoriesCreated: 0,
    productsCreated: 0,
    suppliersCreated: 0,
    customersCreated: 0,
  };

  onProgress?.({
    phase: "dicts",
    written: 0,
    total: 0,
    message: "Завантажуємо існуючі довідники…",
  });

  // 1. Прочитати поточний стан довідників
  const [catSnap, prodSnap, supSnap, custSnap] = await Promise.all([
    getDocs(collection(firebase.db, "categories")),
    getDocs(collection(firebase.db, "products")),
    getDocs(collection(firebase.db, "suppliers")),
    getDocs(collection(firebase.db, "customers")),
  ]);

  // 2. Індекси для швидкого пошуку
  const categoryIndex = new Map<string, { id: string; name: string }>();
  catSnap.docs.forEach((d) => {
    const data = d.data() as Omit<Category, "id">;
    categoryIndex.set(
      catKey(data.name, data.type),
      { id: d.id, name: data.name }
    );
  });

  const productIndex = new Map<string, { id: string; name: string }>();
  prodSnap.docs.forEach((d) => {
    const data = d.data() as Omit<Product, "id">;
    productIndex.set(normalize(data.name), { id: d.id, name: data.name });
  });

  const supplierIndex = new Map<string, { id: string; name: string }>();
  supSnap.docs.forEach((d) => {
    const data = d.data() as Omit<Supplier, "id">;
    supplierIndex.set(normalize(data.name), { id: d.id, name: data.name });
  });

  const customerIndex = new Map<string, { id: string; name: string }>();
  custSnap.docs.forEach((d) => {
    const data = d.data() as Omit<Customer, "id">;
    customerIndex.set(normalize(data.name), { id: d.id, name: data.name });
  });

  // 3. Зібрати всі нові довідники, які треба створити
  const newCategories = new Map<
    string,
    { id: string; name: string; type: TransactionType; color: string }
  >();
  const newProducts = new Map<string, { id: string; name: string }>();
  const newSuppliers = new Map<string, { id: string; name: string }>();
  const newCustomers = new Map<string, { id: string; name: string }>();

  let colorIdx = 0;

  for (const row of rows) {
    const cKey = catKey(row.categoryName, row.type);
    if (!categoryIndex.has(cKey) && !newCategories.has(cKey)) {
      newCategories.set(cKey, {
        id: doc(collection(firebase.db, "categories")).id,
        name: row.categoryName.trim(),
        type: row.type,
        color: DEFAULT_CATEGORY_COLORS[colorIdx++ % DEFAULT_CATEGORY_COLORS.length],
      });
    }

    if (row.productName) {
      const pKey = normalize(row.productName);
      if (!productIndex.has(pKey) && !newProducts.has(pKey)) {
        newProducts.set(pKey, {
          id: doc(collection(firebase.db, "products")).id,
          name: row.productName.trim(),
        });
      }
    }

    if (row.counterpartyName) {
      const kKey = normalize(row.counterpartyName);
      if (row.type === "expense") {
        if (!supplierIndex.has(kKey) && !newSuppliers.has(kKey)) {
          newSuppliers.set(kKey, {
            id: doc(collection(firebase.db, "suppliers")).id,
            name: row.counterpartyName.trim(),
          });
        }
      } else if (!customerIndex.has(kKey) && !newCustomers.has(kKey)) {
        newCustomers.set(kKey, {
          id: doc(collection(firebase.db, "customers")).id,
          name: row.counterpartyName.trim(),
        });
      }
    }
  }

  // 4. Записати нові довідники
  const dictTotal =
    newCategories.size +
    newProducts.size +
    newSuppliers.size +
    newCustomers.size;

  let dictWritten = 0;
  const ts = serverTimestamp();

  if (dictTotal > 0) {
    const dictOps: (() => void)[] = [];
    let batch = writeBatch(firebase.db);
    let batchCount = 0;

    const enqueue = (op: () => void) => {
      op();
      batchCount++;
      if (batchCount >= BATCH_LIMIT) {
        dictOps.push(async () => batch.commit());
        batch = writeBatch(firebase.db);
        batchCount = 0;
      }
    };

    for (const cat of newCategories.values()) {
      enqueue(() => {
        batch.set(doc(firebase.db, "categories", cat.id), {
          name: cat.name,
          type: cat.type,
          color: cat.color,
          sortOrder: 0,
          createdAt: ts,
        });
      });
    }
    for (const p of newProducts.values()) {
      enqueue(() => {
        batch.set(doc(firebase.db, "products", p.id), {
          name: p.name,
          unit: "шт",
          defaultPrice: null,
          defaultCategoryId: null,
          createdAt: ts,
        });
      });
    }
    for (const s of newSuppliers.values()) {
      enqueue(() => {
        batch.set(doc(firebase.db, "suppliers", s.id), {
          name: s.name,
          contact: null,
          notes: null,
          createdAt: ts,
        });
      });
    }
    for (const c of newCustomers.values()) {
      enqueue(() => {
        batch.set(doc(firebase.db, "customers", c.id), {
          name: c.name,
          age: null,
          source: null,
          notes: null,
          createdAt: ts,
        });
      });
    }

    if (batchCount > 0) {
      dictOps.push(async () => batch.commit());
    }

    for (const op of dictOps) {
      await op();
      dictWritten = Math.min(dictWritten + BATCH_LIMIT, dictTotal);
      onProgress?.({
        phase: "dicts",
        written: dictWritten,
        total: dictTotal,
        message: "Створюємо довідники…",
      });
    }

    summary.categoriesCreated = newCategories.size;
    summary.productsCreated = newProducts.size;
    summary.suppliersCreated = newSuppliers.size;
    summary.customersCreated = newCustomers.size;

    // Об'єднати нові з існуючими індексами
    for (const cat of newCategories.values()) {
      categoryIndex.set(catKey(cat.name, cat.type), {
        id: cat.id,
        name: cat.name,
      });
    }
    for (const p of newProducts.values()) {
      productIndex.set(normalize(p.name), { id: p.id, name: p.name });
    }
    for (const s of newSuppliers.values()) {
      supplierIndex.set(normalize(s.name), { id: s.id, name: s.name });
    }
    for (const c of newCustomers.values()) {
      customerIndex.set(normalize(c.name), { id: c.id, name: c.name });
    }
  }

  // 5. Записати транзакції batchами
  onProgress?.({
    phase: "transactions",
    written: 0,
    total: rows.length,
    message: "Завантажуємо транзакції…",
  });

  const txCollection = collection(firebase.db, "transactions");
  let txBatch = writeBatch(firebase.db);
  let txInBatch = 0;
  let written = 0;

  for (const row of rows) {
    const cat = categoryIndex.get(catKey(row.categoryName, row.type));
    if (!cat) continue;

    const prod = row.productName
      ? productIndex.get(normalize(row.productName))
      : null;

    let supplierId: string | null = null;
    let supplierName: string | null = null;
    let customerId: string | null = null;
    let customerName: string | null = null;

    if (row.counterpartyName) {
      if (row.type === "expense") {
        const sup = supplierIndex.get(normalize(row.counterpartyName));
        supplierId = sup?.id ?? null;
        supplierName = sup?.name ?? null;
      } else {
        const cust = customerIndex.get(normalize(row.counterpartyName));
        customerId = cust?.id ?? null;
        customerName = cust?.name ?? null;
      }
    }

    txBatch.set(doc(txCollection), {
      date: Timestamp.fromDate(row.date),
      type: row.type,
      categoryId: cat.id,
      categoryName: cat.name,
      productId: prod?.id ?? null,
      productName: prod?.name ?? row.productName ?? null,
      supplierId,
      supplierName,
      customerId,
      customerName,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      totalAmount: row.totalAmount,
      note: row.note,
      createdBy: uid,
      createdAt: ts,
      updatedAt: ts,
    });
    txInBatch++;
    written++;

    if (txInBatch >= BATCH_LIMIT) {
      await txBatch.commit();
      txBatch = writeBatch(firebase.db);
      txInBatch = 0;
      onProgress?.({
        phase: "transactions",
        written,
        total: rows.length,
      });
    }
  }

  if (txInBatch > 0) {
    await txBatch.commit();
  }

  summary.transactionsCreated = written;

  onProgress?.({
    phase: "done",
    written,
    total: rows.length,
  });

  return summary;
}

function catKey(name: string, type: TransactionType): string {
  return `${type}::${normalize(name)}`;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
