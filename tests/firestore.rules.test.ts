import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

let env: RulesTestEnvironment;

const PROJECT_ID = "lavanda-oblik-rules-test";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(
        path.resolve(__dirname, "../firestore.rules"),
        "utf8"
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function admin() {
  return env.authenticatedContext("admin-uid").firestore();
}

function viewer() {
  return env.authenticatedContext("viewer-uid").firestore();
}

function anon() {
  return env.unauthenticatedContext().firestore();
}

async function seedUsers() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/admin-uid"), {
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "users/viewer-uid"), {
      email: "viewer@example.com",
      name: "Viewer",
      role: "viewer",
      createdAt: Timestamp.now(),
    });
  });
}

const validCategory = {
  name: "Продукція",
  type: "income",
  color: "#7c5cbb",
  sortOrder: 0,
  createdAt: serverTimestamp(),
};

const validTx = (uid: string) => ({
  date: Timestamp.now(),
  type: "income" as const,
  categoryId: "cat1",
  categoryName: "Продукція",
  productId: null,
  productName: null,
  supplierId: null,
  supplierName: null,
  customerId: null,
  customerName: null,
  unitPrice: 200,
  quantity: 1,
  totalAmount: 200,
  note: null,
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

describe("users", () => {
  it("неавторизований не може читати users", async () => {
    await seedUsers();
    await assertFails(getDoc(doc(anon(), "users/admin-uid")));
  });

  it("авторизований може читати users", async () => {
    await seedUsers();
    await assertSucceeds(getDoc(doc(viewer(), "users/admin-uid")));
  });

  it("юзер може створити свій документ", async () => {
    await assertSucceeds(
      setDoc(doc(viewer(), "users/viewer-uid"), {
        email: "viewer@example.com",
        name: "V",
        role: "viewer",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("юзер НЕ може створити чужий документ", async () => {
    await assertFails(
      setDoc(doc(viewer(), "users/somebody-else"), {
        email: "x@example.com",
        name: "X",
        role: "viewer",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("юзер НЕ може створити документ з невалідною роллю", async () => {
    await assertFails(
      setDoc(doc(viewer(), "users/viewer-uid"), {
        email: "v@example.com",
        name: "V",
        role: "superadmin",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("viewer НЕ може підвищити сам себе до admin", async () => {
    await seedUsers();
    await assertFails(
      updateDoc(doc(viewer(), "users/viewer-uid"), { role: "admin" })
    );
  });

  it("viewer може змінити своє ім'я", async () => {
    await seedUsers();
    await assertSucceeds(
      updateDoc(doc(viewer(), "users/viewer-uid"), { name: "New Name" })
    );
  });

  it("admin може підвищити viewer до admin", async () => {
    await seedUsers();
    await assertSucceeds(
      updateDoc(doc(admin(), "users/viewer-uid"), { role: "admin" })
    );
  });

  it("admin може видалити користувача", async () => {
    await seedUsers();
    await assertSucceeds(deleteDoc(doc(admin(), "users/viewer-uid")));
  });

  it("viewer НЕ може видалити користувача", async () => {
    await seedUsers();
    await assertFails(deleteDoc(doc(viewer(), "users/admin-uid")));
  });
});

describe("categories", () => {
  it("admin може створити категорію", async () => {
    await seedUsers();
    await assertSucceeds(
      setDoc(doc(admin(), "categories/cat1"), validCategory)
    );
  });

  it("viewer НЕ може створити категорію", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(viewer(), "categories/cat1"), validCategory)
    );
  });

  it("неавторизований не може читати категорії", async () => {
    await seedUsers();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "categories/cat1"), validCategory);
    });
    await assertFails(getDoc(doc(anon(), "categories/cat1")));
  });

  it("admin не може створити категорію з невалідним type", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(admin(), "categories/bad"), {
        ...validCategory,
        type: "weird",
      })
    );
  });

  it("admin не може створити категорію без name", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(admin(), "categories/bad"), {
        ...validCategory,
        name: "",
      })
    );
  });
});

describe("transactions", () => {
  it("admin може створити транзакцію", async () => {
    await seedUsers();
    await assertSucceeds(
      setDoc(doc(admin(), "transactions/t1"), validTx("admin-uid"))
    );
  });

  it("admin не може створити транзакцію з createdBy чужого uid", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(admin(), "transactions/t1"), validTx("somebody-else"))
    );
  });

  it("admin не може створити транзакцію з від'ємною ціною", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(admin(), "transactions/bad"), {
        ...validTx("admin-uid"),
        unitPrice: -100,
      })
    );
  });

  it("viewer НЕ може створити транзакцію", async () => {
    await seedUsers();
    await assertFails(
      setDoc(doc(viewer(), "transactions/t1"), validTx("viewer-uid"))
    );
  });

  it("admin може видалити транзакцію", async () => {
    await seedUsers();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "transactions/t1"),
        validTx("admin-uid")
      );
    });
    await assertSucceeds(deleteDoc(doc(admin(), "transactions/t1")));
  });
});

describe("захист інших колекцій", () => {
  it("неавторизована колекція повністю заблокована", async () => {
    await assertFails(getDoc(doc(anon(), "secrets/foo")));
    await assertFails(setDoc(doc(admin(), "secrets/foo"), { x: 1 }));
  });
});
