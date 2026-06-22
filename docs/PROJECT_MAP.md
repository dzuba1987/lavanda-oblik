# Карта проєкту — ЛавандаОблік

> Завантажується в контекст щосесії через `CLAUDE.md`. Тримай актуальним.
> Мета: дати орієнтир без сканування коду. Деталі — читай конкретний файл.

PWA для малого бізнесу: облік замовлень, фотосесій, фінансів, складу.
Next.js 16 (SSG export) + Firebase (Auth/Firestore) + Telegram-нотифікації.
UI українською. Працюй на `localhost:3000` (не IP — інакше Google OAuth `auth/unauthorized-domain`).

## Стек

| Шар | Технологія |
|---|---|
| Framework | Next.js 16.2.6 (App Router, `output: "export"`, `trailingSlash: true`) |
| UI | React 19.2, Tailwind 4, shadcn/ui, Radix, lucide-react, sonner |
| Дані | Firebase 12.13 (Auth + Firestore + App Check/ReCAPTCHA), persistent cache |
| Графіки | recharts 3.8 |
| Інше | date-fns (uk locale), exceljs (імпорт), fuse.js (combobox), react-day-picker |
| Тести | vitest + @firebase/rules-unit-testing (тільки правила) |

## Команди

```bash
npm run dev            # дев-сервер :3000
npm run build          # SSG → ./out/
npm run lint           # ESLint
npx tsc --noEmit       # тайпчек (роби перед комітом)
npm run test:rules     # тести firestore.rules (потрібен емулятор)
npm run emulators      # Firebase emulator suite
npm run deploy         # build + firebase deploy (hosting + rules)
npm run deploy:rules   # тільки правила
```

## Структура

```
app/
  layout.tsx              root: AuthProvider, Toaster, PWARegister, BootLoader
  page.tsx                лендинг → редірект (mobile→/orders/, desktop→/dashboard/)
  login/                  публічна авторизація (email+pass з CAPTCHA, Google OAuth)
  (app)/                  auth-gated група (логін + роль admin/seller)
    layout.tsx            auth-gate + AppShell (сайдбар-навігація)
    dashboard/            KPI + графіки + блок «Фотосесії» (зарезервовані години)
    orders/               список/створення замовлень
      view/               деталі замовлення (фото, доставка, коментарі, статуси)
    bookings/             КАЛЕНДАР фотосесій (variant D: міні-місяць + денний таймлайн)
    transactions/         доходи/витрати
    inventory/            склад
    analytics/            звіти (сезонність, топ-товари, контрагенти)
    settings/             admin-only; layout з табами-підменю
      products/ categories/ customers/ suppliers/ users/
      import/ notifications/ changelog/ dev/
    help/

components/
  AppShell.tsx            сайдбар + bottom-nav, badge-лічильники (нові замовл., фотосесії)
  OrderForm.tsx           форма замовлення; якщо є товар «Фотосесія» → поля сеансу + СИНК з bookings
  TransactionForm.tsx     форма транзакції
  EntityCombobox.tsx      пошук+створення (клієнти/постачальники/товари), fuse.js
  PeriodFilter.tsx        вибір періоду (presets + day-picker)
  CrudPage.tsx            generic список/форма (categories, products, customers...)
  AuditInfo.tsx           хто/коли створив/оновив (толерантний до undefined)
  charts/                 recharts: IncomeExpense, CategoryPie, TopProducts, Seasonality...
  ui/                     shadcn/ui примітиви
  import/                 майстер імпорту Excel

lib/
  firebase/client.ts      getFirebase() singleton (auth, db, App Check, emulator)
  auth/AuthContext.tsx    login/signup, presence heartbeat (lastSeenAt), перевірка ролі
  data/
    crud.ts               makeCrud<T>() фабрика — серце дата-шару (див. нижче)
    audit.ts              currentAudit() — uid+name з firebase.auth.currentUser
    types.ts              ВСІ доменні інтерфейси + enum (єдине джерело правди)
    orders.ts             CRUD замовлень + переходи статусів + генерація транзакцій + лінк з bookings
    bookings.ts           bookingsCrud = makeCrud<Booking>("bookings", orderBy start asc)
    transactions.ts       доходи/витрати
    products.ts customers.ts suppliers.ts categories.ts suppliers.ts users.ts
    comments.ts           підколекція orders/{id}/comments
    dictionaries.ts       enum з Firestore
    useNewOrdersCount.ts          realtime badge «нові замовлення»
    useUpcomingBookingsCount.ts   realtime badge «майбутні фотосесії» (admin-only)
  notify/telegram.ts      нотифікації через Laravel-бекенд (fire-and-forget)
  utils/
    format.ts             tsToDate, formatDateTime, toInputDate/Time, formatMoney/Number
    payment.ts delivery.ts period.ts image.ts
  analytics.ts            computeTotals, monthlyTrend, categoryBreakdown, topProducts
  ai/                     Gemini-парсинг голосових замовлень (parseOrder, customerMatch)

hooks/use-is-mobile.ts
tests/firestore.rules.test.ts
firestore.rules           правила безпеки (admin-only більшість)
```

## Дата-шар: makeCrud

`lib/data/crud.ts`:
```ts
makeCrud<T>(collectionName, defaultOrder?: QueryConstraint[])
  → { list(extra?), create(data)→id, update(id, patch), remove(id) }
```
- Кожна колекція = один `xxxCrud = makeCrud<Omit<X,"id">>("xxx", [...])`.
- create/update авто-додають audit-поля через `currentAudit()`:
  `createdBy/createdByName/createdAt`, `updatedBy/updatedByName/updatedAt`.
- Firestore правила НЕ відхиляють незадекларовані поля.

## Доменні enum (`lib/data/types.ts`)

- `Role` = admin | seller | viewer (перший юзер → admin)
- `OrderStatus` = new | confirmed | in_progress | assembled | ready  *(нема cancelled/delivered!)*
- `BookingStatus` = tentative | confirmed | done | cancelled
- `PaymentStatus` = unpaid | paid ; `PaymentMethod` = cash | card
- `DeliveryMethod` = nova_poshta | ukrposhta | meest | courier | self_pickup | other

## Зв'язок Замовлення ↔ Фотосесія

- Товар з назвою `/фотосес/i` → OrderForm показує поля сеансу (дата+час+тривалість+тип), ховає доставку та фото.
- Двосторонній лінк: `Order.bookingId` ↔ `Booking.orderId`.
- Синк при save (create/update booking) та cleanup при видаленні обох сторін.
- `bStatus = orderStatus === "ready" ? "done" : "confirmed"`.

## Бекенд (Telegram)

- Laravel `invest-notify/` — СУСІДНЯ папка (`../invest-notify`).
- `lib/notify/telegram.ts` → POST `/api/lavanda/telegram/{new-user,new-order,new-booking,order-status,test,broadcast}`.
- Env: `NEXT_PUBLIC_NOTIFY_API_BASE`, `NEXT_PUBLIC_NOTIFY_API_KEY` (header `X-API-Key`), `NEXT_PUBLIC_LAVANDA_BOT_NAME`.
- Деплой бекенду: `../invest-notify/deploy.sh` (Hostinger SSH, `git archive HEAD` — СПОЧАТКУ закомить).
- Прапори в settings: `notifyNewUser/Order/Booking/OrderStatus`.
- Фан-аут на admin chat_ids (`users/{uid}.telegramChatId`).

## Конвенції

- Усі сторінки/компоненти — `"use client"`.
- UI-текст українською; дата `dd.MM.yyyy`, час 24h, валюта ₴.
- `useSearchParams` → потрібен `<Suspense>`.
- Працюй прямо в `main` (без PR-флоу).
- Перед комітом: `npx tsc --noEmit` + перевір що сторінка 200.
```

