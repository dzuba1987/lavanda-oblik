# ЛавандаОблік

PWA для обліку витрат і продажів Лавандового поля — на телефоні та в браузері.

## Стек

- **Next.js 16** (App Router, static export) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **Firebase** (Firestore + Auth + Hosting)
- **Recharts** для графіків, **ExcelJS** для імпорту .xlsx

## Розробка

```bash
npm install
npm run dev          # http://localhost:3000
```

Заповніть `.env.local` значеннями з Firebase Console → Project Settings → Web App (див. `.env.local.example`).

## Корисні команди

```bash
npm run build              # static export у out/
npm run emulators          # Firebase Emulator Suite (потребує Java)
npm run deploy             # build + firebase deploy
npm run deploy:rules       # тільки firestore.rules
npm run deploy:indexes     # тільки firestore.indexes.json
```

## Telegram-сповіщення

Підключаються до зовнішнього Laravel-бекенду `invest-notify` (той самий, що
обслуговує Invest UA). Endpoints — `/api/lavanda/telegram/*`. Bot — окремий,
налаштовується у `.env`.

**Frontend (`.env.local`):**

```env
NEXT_PUBLIC_NOTIFY_API_BASE=https://your-host/api
NEXT_PUBLIC_NOTIFY_API_KEY=<той самий API_SECRET_KEY, що на бекенді>
NEXT_PUBLIC_LAVANDA_BOT_NAME=lavanda_oblik_bot
```

**Backend (`invest-notify/.env`):**

```env
LAVANDA_TELEGRAM_BOT_TOKEN=<токен від @BotFather>
LAVANDA_TELEGRAM_BOT_NAME=lavanda_oblik_bot
LAVANDA_FRONTEND_URL=https://lavanda-oblik.web.app
LAVANDA_FIREBASE_CREDENTIALS=storage/app/firebase/lavanda-service-account.json
LAVANDA_FIREBASE_PROJECT=lavanda-oblik
```

**Кроки разового налаштування:**

1. Створити бота через [@BotFather](https://t.me/BotFather) → отримати токен.
2. У Firebase Console для `lavanda-oblik` згенерувати service account JSON,
   покласти у `invest-notify/storage/app/firebase/lavanda-service-account.json`.
3. На сервері виконати:
   ```bash
   php artisan lavanda:telegram:set-webhook https://your-host/api/lavanda/telegram/webhook
   php artisan lavanda:telegram:set-commands
   ```
4. У додатку: Налаштування → Сповіщення → «Підключити Telegram».

**Що відсилається:**

- 🆕 Новий користувач підписався → `settings/telegram.chatId` (якщо
  `notifyNewUser=true`) + усі адміни з прив'язаним TG (окрім самого новачка).
- 🛒 Створено замовлення → усі адміни з прив'язаним TG (включно з автором,
  щоб мати підтвердження надходження).

## Структура

```
app/
  (app)/                # захищені роути (вимагають auth)
    dashboard/
    transactions/
    analytics/
    settings/
  login/                # публічний вхід
components/
  ui/                   # shadcn-компоненти
  AppShell.tsx          # sidebar + bottom-nav + profile menu
lib/
  firebase/client.ts    # лінива ініціалізація Firebase
  auth/AuthContext.tsx  # AuthProvider + useAuth()
  data/                 # типи + CRUD-обгортки над Firestore
firestore.rules         # security rules
firestore.indexes.json  # індекси Firestore
firebase.json           # конфіг Hosting/Firestore/Emulators
```
