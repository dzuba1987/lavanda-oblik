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
