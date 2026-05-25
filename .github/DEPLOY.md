# GitHub Actions — авто-деплой

Workflow-файли:

- `firebase-deploy.yml` — на push у `main` → білд + деплой Firestore rules/indexes + Hosting
- `firebase-preview.yml` — на PR → preview-канал з тимчасовим URL

## Що потрібно налаштувати в GitHub Secrets (одноразово)

`Settings → Secrets and variables → Actions → New repository secret`:

| Назва | Значення |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account (див. нижче) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | з вашого `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `lavanda-oblik.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `lavanda-oblik` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `lavanda-oblik.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | з вашого `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | з вашого `.env.local` |

## Як отримати `FIREBASE_SERVICE_ACCOUNT`

### Варіант 1: через Firebase CLI (рекомендую)

```bash
npx firebase init hosting:github
```

Він:
1. Відкриє браузер для GitHub-авторизації
2. Створить service account `github-action-<id>@lavanda-oblik.iam.gserviceaccount.com`
3. Автоматично додасть JSON у GitHub Secrets під назвою `FIREBASE_SERVICE_ACCOUNT_LAVANDA_OBLIK`
4. Згенерує `firebase-hosting-merge.yml` (його видалити — наш `firebase-deploy.yml` робить те ж саме)

⚠️ **Назва секрету буде `FIREBASE_SERVICE_ACCOUNT_LAVANDA_OBLIK`** — перейменуйте в Secrets на `FIREBASE_SERVICE_ACCOUNT`, або змініть наш workflow.

### Варіант 2: вручну через Google Cloud Console

1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=lavanda-oblik
2. **Create Service Account** → ім'я `github-deploy`
3. Ролі:
   - `Firebase Hosting Admin`
   - `Cloud Datastore Index Admin`
   - `Firebase Rules Admin`
   - `Cloud Datastore User`
4. Створити → відкрити цей акаунт → **Keys** → **Add key → JSON** → завантажиться файл
5. Скопіювати **вміст всього JSON-файлу** → у GitHub Secret `FIREBASE_SERVICE_ACCOUNT`

## Як це працює

- `git push origin main` → workflow `firebase-deploy.yml` запускається на GitHub
- Білд → деплой rules+indexes → деплой hosting
- ~2 хв пізніше → live на https://lavanda-oblik.web.app

- PR → workflow `firebase-preview.yml` створює preview-канал (унікальний URL у коментарі під PR), який живе 7 днів

## Локальний деплой (як було)

Залишається доступним — `npm run deploy` / `npm run deploy:rules` / `npm run deploy:hosting`. Useful для emergency-фіксів без push.
