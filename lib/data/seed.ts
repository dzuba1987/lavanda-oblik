import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { DEFAULT_CATEGORY_COLORS } from "./categories";
import type { OrderItem, OrderStatus, TransactionType } from "./types";

const SEED_COLLECTIONS = [
  "categories",
  "products",
  "suppliers",
  "customers",
  "transactions",
  "orders",
] as const;

type SeedCounts = Record<(typeof SEED_COLLECTIONS)[number], number>;

const CATEGORIES: { name: string; type: TransactionType }[] = [
  { name: "Продаж букетів", type: "income" },
  { name: "Продаж саджанців", type: "income" },
  { name: "Продаж сухоцвіту", type: "income" },
  { name: "Ефірна олія", type: "income" },
  { name: "Екскурсії", type: "income" },
  { name: "Косметика", type: "income" },
  { name: "Насіння та саджанці", type: "expense" },
  { name: "Добрива", type: "expense" },
  { name: "Паливо", type: "expense" },
  { name: "Оренда", type: "expense" },
  { name: "Зарплата", type: "expense" },
  { name: "Реклама", type: "expense" },
  { name: "Упаковка", type: "expense" },
  { name: "Інше", type: "expense" },
];

const PRODUCTS: { name: string; unit: string; price: number; categoryName: string }[] = [
  { name: "Букет лаванди малий", unit: "шт", price: 120, categoryName: "Продаж букетів" },
  { name: "Букет лаванди великий", unit: "шт", price: 250, categoryName: "Продаж букетів" },
  { name: "Саджанець лаванди", unit: "шт", price: 80, categoryName: "Продаж саджанців" },
  { name: "Сухоцвіт пучок", unit: "шт", price: 90, categoryName: "Продаж сухоцвіту" },
  { name: "Сухоцвіт у мішечку", unit: "шт", price: 60, categoryName: "Продаж сухоцвіту" },
  { name: "Ефірна олія 10 мл", unit: "шт", price: 350, categoryName: "Ефірна олія" },
  { name: "Гідролат 100 мл", unit: "шт", price: 180, categoryName: "Косметика" },
  { name: "Мило з лавандою", unit: "шт", price: 95, categoryName: "Косметика" },
  { name: "Екскурсія полем", unit: "особа", price: 200, categoryName: "Екскурсії" },
  { name: "Фотосесія", unit: "сеанс", price: 500, categoryName: "Екскурсії" },
];

const SUPPLIERS: { name: string; contact: string }[] = [
  { name: "Агровіні", contact: "+380501112233" },
  { name: "Магазин насіння \"Зерно\"", contact: "+380672223344" },
  { name: "АЗС WOG", contact: "" },
  { name: "Орендодавець (поле)", contact: "Іван Петрович" },
  { name: "Друкарня \"Принт\"", contact: "print@example.com" },
  { name: "Тара та упаковка", contact: "+380983334455" },
];

const CUSTOMER_NAMES = [
  "Оксана", "Марія", "Анна", "Катерина", "Юлія", "Наталія",
  "Тетяна", "Ірина", "Софія", "Олена", "Вікторія", "Дарина",
  "Ольга", "Світлана", "Леся", "Уляна", "Богдана", "Христина",
];

const SOURCES = ["Instagram", "Сарафан", "Сайт", "Маркетплейс", "Екскурсія"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(8, 20), randInt(0, 59), 0, 0);
  return d;
}

export async function seedTestData(uid: string): Promise<SeedCounts> {
  const db = firebase.db;
  const counts: SeedCounts = {
    categories: 0,
    products: 0,
    suppliers: 0,
    customers: 0,
    transactions: 0,
    orders: 0,
  };

  const catRefs = new Map<string, { id: string; name: string; type: TransactionType }>();
  const refsBatch = writeBatch(db);
  CATEGORIES.forEach((c, idx) => {
    const ref = doc(collection(db, "categories"));
    refsBatch.set(ref, {
      name: c.name,
      type: c.type,
      color: DEFAULT_CATEGORY_COLORS[idx % DEFAULT_CATEGORY_COLORS.length],
      sortOrder: idx,
      seed: true,
      createdAt: serverTimestamp(),
    });
    catRefs.set(c.name, { id: ref.id, name: c.name, type: c.type });
    counts.categories++;
  });

  const productRefs: { id: string; name: string; price: number; categoryName: string }[] = [];
  PRODUCTS.forEach((p) => {
    const cat = catRefs.get(p.categoryName);
    if (!cat) return;
    const ref = doc(collection(db, "products"));
    refsBatch.set(ref, {
      name: p.name,
      unit: p.unit,
      defaultPrice: p.price,
      defaultCategoryId: cat.id,
      seed: true,
      createdAt: serverTimestamp(),
    });
    productRefs.push({ id: ref.id, name: p.name, price: p.price, categoryName: p.categoryName });
    counts.products++;
  });

  const supplierRefs: { id: string; name: string }[] = [];
  SUPPLIERS.forEach((s) => {
    const ref = doc(collection(db, "suppliers"));
    refsBatch.set(ref, {
      name: s.name,
      contact: s.contact || null,
      notes: null,
      seed: true,
      createdAt: serverTimestamp(),
    });
    supplierRefs.push({ id: ref.id, name: s.name });
    counts.suppliers++;
  });

  const customerRefs: { id: string; name: string }[] = [];
  CUSTOMER_NAMES.forEach((name) => {
    const ref = doc(collection(db, "customers"));
    refsBatch.set(ref, {
      name,
      age: randInt(22, 60),
      source: pick(SOURCES),
      notes: null,
      seed: true,
      createdAt: serverTimestamp(),
    });
    customerRefs.push({ id: ref.id, name });
    counts.customers++;
  });

  await refsBatch.commit();

  const expenseSuppliers: Record<string, string[]> = {
    "Насіння та саджанці": ["Магазин насіння \"Зерно\"", "Агровіні"],
    "Добрива": ["Агровіні"],
    "Паливо": ["АЗС WOG"],
    "Оренда": ["Орендодавець (поле)"],
    "Реклама": ["Друкарня \"Принт\""],
    "Упаковка": ["Тара та упаковка"],
    "Зарплата": [],
    "Інше": [],
  };

  const productsByCategory = new Map<string, typeof productRefs>();
  productRefs.forEach((p) => {
    const arr = productsByCategory.get(p.categoryName) ?? [];
    arr.push(p);
    productsByCategory.set(p.categoryName, arr);
  });

  const incomeCats = CATEGORIES.filter((c) => c.type === "income").map((c) => c.name);
  const expenseCats = CATEGORIES.filter((c) => c.type === "expense").map((c) => c.name);

  const TOTAL_TX = 260;
  let written = 0;
  let batch = writeBatch(db);
  let inBatch = 0;

  for (let i = 0; i < TOTAL_TX; i++) {
    const isIncome = Math.random() < 0.6;
    const daysAgo = randInt(0, 179);
    const summerBoost = (() => {
      const m = dateNDaysAgo(daysAgo).getMonth();
      return m >= 5 && m <= 7;
    })();
    if (!isIncome && summerBoost && Math.random() < 0.3) continue;

    const date = dateNDaysAgo(daysAgo);

    if (isIncome) {
      const categoryName = pick(incomeCats);
      const cat = catRefs.get(categoryName)!;
      const productCandidates = productsByCategory.get(categoryName) ?? [];
      const product = productCandidates.length ? pick(productCandidates) : null;
      const unitPrice = product
        ? Math.max(20, Math.round(product.price * (0.9 + Math.random() * 0.3)))
        : randInt(50, 400);
      const quantity = randInt(1, summerBoost ? 8 : 3);
      const customer = pick(customerRefs);
      const ref = doc(collection(db, "transactions"));
      batch.set(ref, {
        date: Timestamp.fromDate(date),
        type: "income" as TransactionType,
        categoryId: cat.id,
        categoryName: cat.name,
        productId: product?.id ?? null,
        productName: product?.name ?? null,
        supplierId: null,
        supplierName: null,
        customerId: customer.id,
        customerName: customer.name,
        unitPrice,
        quantity,
        totalAmount: unitPrice * quantity,
        note: null,
        createdBy: uid,
        seed: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const categoryName = pick(expenseCats);
      const cat = catRefs.get(categoryName)!;
      const supplierNames = expenseSuppliers[categoryName] ?? [];
      const supplier = supplierNames.length
        ? supplierRefs.find((s) => s.name === pick(supplierNames)) ?? null
        : null;
      const baseAmount = (() => {
        switch (categoryName) {
          case "Оренда": return randInt(3000, 6000);
          case "Зарплата": return randInt(8000, 15000);
          case "Реклама": return randInt(500, 3000);
          case "Паливо": return randInt(800, 2500);
          case "Добрива": return randInt(400, 2000);
          case "Насіння та саджанці": return randInt(300, 1800);
          case "Упаковка": return randInt(200, 1200);
          default: return randInt(150, 1500);
        }
      })();
      const quantity = 1;
      const ref = doc(collection(db, "transactions"));
      batch.set(ref, {
        date: Timestamp.fromDate(date),
        type: "expense" as TransactionType,
        categoryId: cat.id,
        categoryName: cat.name,
        productId: null,
        productName: null,
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? null,
        customerId: null,
        customerName: null,
        unitPrice: baseAmount,
        quantity,
        totalAmount: baseAmount * quantity,
        note: null,
        createdBy: uid,
        seed: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    written++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();
  counts.transactions = written;

  // === Тестові замовлення ===
  const ordersWritten = await seedOrders(uid, catRefs, productRefs, customerRefs);
  counts.orders = ordersWritten;

  return counts;
}

type CatRef = { id: string; name: string; type: TransactionType };
type ProdRef = { id: string; name: string; price: number; categoryName: string };
type CustRef = { id: string; name: string };

async function seedOrders(
  uid: string,
  catRefs: Map<string, CatRef>,
  productRefs: ProdRef[],
  customerRefs: CustRef[]
): Promise<number> {
  const db = firebase.db;
  const now = new Date();

  function daysFromNow(n: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  function findProduct(name: string): ProdRef | null {
    return productRefs.find((p) => p.name === name) ?? null;
  }

  function makeItem(
    productName: string,
    quantity: number,
    priceOverride?: number
  ): OrderItem | null {
    const prod = findProduct(productName);
    if (!prod) return null;
    const cat = catRefs.get(prod.categoryName);
    if (!cat) return null;
    const unitPrice = priceOverride ?? prod.price;
    return {
      productId: prod.id,
      productName: prod.name,
      categoryId: cat.id,
      categoryName: cat.name,
      unitPrice,
      quantity,
      totalAmount: unitPrice * quantity,
    };
  }

  type SeedOrder = {
    customerName: string;
    status: OrderStatus;
    deadlineOffsetDays: number | null;
    items: { product: string; qty: number; price?: number }[];
    notes: string | null;
    createdDaysAgo: number;
  };

  const SEED_ORDERS: SeedOrder[] = [
    {
      customerName: "Сергій меблі",
      status: "new",
      deadlineOffsetDays: 3,
      items: [{ product: "Букет лаванди малий", qty: 10, price: 100 }],
      notes: "Корпоративний подарунок співробітникам",
      createdDaysAgo: 1,
    },
    {
      customerName: "Анна",
      status: "confirmed",
      deadlineOffsetDays: 7,
      items: [{ product: "Екскурсія полем", qty: 10, price: 700 }],
      notes: "Майстер-клас на 10 учасників",
      createdDaysAgo: 2,
    },
    {
      customerName: "Марія",
      status: "in_progress",
      deadlineOffsetDays: 5,
      items: [
        { product: "Ефірна олія 10 мл", qty: 5 },
        { product: "Гідролат 100 мл", qty: 5 },
      ],
      notes: "Подарунковий набір під весілля",
      createdDaysAgo: 4,
    },
    {
      customerName: "Тетяна",
      status: "ready",
      deadlineOffsetDays: 1,
      items: [{ product: "Букет лаванди великий", qty: 3 }],
      notes: "Самовивіз з поля у п'ятницю",
      createdDaysAgo: 6,
    },
    {
      customerName: "Юлія",
      status: "ready",
      deadlineOffsetDays: -2,
      items: [{ product: "Сухоцвіт пучок", qty: 8 }],
      notes: "ПРОСТРОЧЕНО — клієнт не забрав",
      createdDaysAgo: 14,
    },
    {
      customerName: "Оксана",
      status: "cancelled",
      deadlineOffsetDays: 10,
      items: [{ product: "Саджанець лаванди", qty: 50, price: 70 }],
      notes: "Клієнт скасував",
      createdDaysAgo: 9,
    },
  ];

  let batch = writeBatch(db);
  let written = 0;

  for (const seedOrder of SEED_ORDERS) {
    const cust = customerRefs.find((c) => c.name === seedOrder.customerName);
    const items = seedOrder.items
      .map((it) => makeItem(it.product, it.qty, it.price))
      .filter((it): it is OrderItem => it !== null);

    if (items.length === 0) continue;

    const totalAmount = items.reduce((acc, it) => acc + it.totalAmount, 0);
    const deadline =
      seedOrder.deadlineOffsetDays !== null
        ? daysFromNow(seedOrder.deadlineOffsetDays)
        : null;
    const createdAt = dateNDaysAgo(seedOrder.createdDaysAgo);

    const ref = doc(collection(db, "orders"));
    batch.set(ref, {
      customerId: cust?.id ?? null,
      customerName: seedOrder.customerName,
      items,
      totalAmount,
      deadline: deadline ? Timestamp.fromDate(deadline) : null,
      status: seedOrder.status,
      notes: seedOrder.notes,
      transactionIds: [],
      deliveredAt: null,
      createdBy: uid,
      seed: true,
      createdAt: Timestamp.fromDate(createdAt),
      updatedAt: Timestamp.fromDate(createdAt),
    });
    written++;
  }

  await batch.commit();
  return written;
}

export async function removeSeedData(): Promise<SeedCounts> {
  const db = firebase.db;
  const counts: SeedCounts = {
    categories: 0,
    products: 0,
    suppliers: 0,
    customers: 0,
    transactions: 0,
    orders: 0,
  };

  for (const name of SEED_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, name), where("seed", "==", true)));
    if (snap.empty) continue;

    let batch = writeBatch(db);
    let inBatch = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      inBatch++;
      counts[name]++;
      if (inBatch >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();
  }

  return counts;
}
