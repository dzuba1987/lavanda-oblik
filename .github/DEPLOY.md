# GitHub Actions — авто-деплой

Workflow-файли:

- `firebase-deploy.yml` — на push у `main` → білд + деплой Firestore rules/indexes + Hosting
- `firebase-preview.yml` — на PR → preview-канал з тимчасовим URL

## Налаштування (одноразово)

Потрібен лише **один secret** у GitHub:

`Settings → Secrets and variables → Actions`:

| Назва | Звідки взяти |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_LAVANDA_OBLIK` | Створюється автоматично через `firebase init hosting:github` |

Firebase public-ключі (`NEXT_PUBLIC_FIREBASE_*`) лежать у `.env.production` у git — це безпечно, бо доступ до даних контролюється Firestore Security Rules, а не приховуванням ключів.

## Як це працює

- `git push origin main` → `firebase-deploy.yml` запускається
- Білд → деплой rules+indexes → деплой hosting
- ~2 хв пізніше → live на https://lavanda-oblik.web.app

- PR → `firebase-preview.yml` створює preview-канал (унікальний URL у коментарі під PR), який живе 7 днів

## Локальний деплой (як було)

Залишається доступним — `npm run deploy` / `npm run deploy:rules` / `npm run deploy:hosting`. Корисно для emergency-фіксів без push або коли треба швидко перевірити зміну.
