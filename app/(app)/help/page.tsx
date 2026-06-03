import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpHashOpener } from "@/components/HelpHashOpener";

export const metadata = {
  title: "Довідка — ЛавандаОблік",
};

const TOC: { href: string; label: string }[] = [
  { href: "#overview", label: "Огляд" },
  { href: "#dashboard", label: "Дашборд" },
  { href: "#orders", label: "Замовлення" },
  { href: "#delivery", label: "Доставка" },
  { href: "#photos-voice", label: "Фото · Голос · Коментарі" },
  { href: "#transactions", label: "Транзакції" },
  { href: "#analytics", label: "Аналітика" },
  { href: "#categories", label: "Категорії" },
  { href: "#products", label: "Товари" },
  { href: "#suppliers", label: "Постачальники" },
  { href: "#customers", label: "Клієнти" },
  { href: "#import", label: "Імпорт з Excel" },
  { href: "#notifications", label: "Telegram-сповіщення" },
  { href: "#users", label: "Користувачі та ролі" },
  { href: "#data", label: "Дані та безпека" },
];

export default function HelpPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6 pb-24 md:pb-6">
      <HelpHashOpener />

      <header className="space-y-2">
        <Link
          href="/settings/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Довідка</h1>
        <p className="text-sm text-muted-foreground">
          Натисніть на пункт у списку нижче — відповідний блок одразу
          розгорнеться. Або відкривайте секції вручну.
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <nav
            aria-label="Розділи довідки"
            className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
          >
            {TOC.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="text-violet-700 transition-colors hover:underline dark:text-violet-300"
              >
                {t.label}
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      <SectionGroup>Головне</SectionGroup>

      <Collapse id="overview" summary="🌿 Що це за додаток?" defaultOpen>
        <p>
          <strong>ЛавандаОблік</strong> — облікова PWA для невеликого бізнесу
          (фермерські солодощі, варення, продукція з лавандою). Веде
          замовлення, рух коштів і базові аналітичні зрізи. Дані синхронізуються
          в реальному часі між пристроями всіх членів команди.
        </p>
        <FeatureGrid
          items={[
            {
              title: "📋 Замовлення",
              desc:
                "Lifecycle Нове → Підтверджено → В роботі → Готове до видачі → Виконано з фото, доставкою і коментарями",
            },
            {
              title: "💸 Транзакції",
              desc:
                "Доходи / витрати з категоріями, прив'язкою до товару, клієнта чи постачальника",
            },
            {
              title: "📊 Аналітика",
              desc: "Виторг, прибутковість, топ товари, динаміка по періодах",
            },
            {
              title: "🤖 Telegram",
              desc:
                "Сповіщення про нові замовлення, зміну статусів, реєстрацію користувачів",
            },
            {
              title: "🎙 Голосовий ввід",
              desc:
                "Замовлення голосом — AI розпарсить клієнта, товари й доставку",
            },
            {
              title: "👥 Команда",
              desc: "Ролі admin / seller, керування доступом",
            },
          ]}
        />
      </Collapse>

      <Collapse id="dashboard" summary="🏠 Дашборд">
        <p>
          Головна сторінка <code>/dashboard/</code> показує зведення:
        </p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Активні замовлення</strong> — у статусах «Нове»,
            «Підтверджено», «В роботі», «Готове до видачі»
          </li>
          <li>
            <strong>Прибуток за місяць</strong> — доходи мінус витрати за
            поточний місяць
          </li>
          <li>
            <strong>Топ-5 товарів</strong> — клік відкриває фільтр транзакцій
            по конкретному товару (за весь час)
          </li>
          <li>
            <strong>Останні замовлення / транзакції</strong> — швидкий доступ
            до недавніх записів
          </li>
        </ul>
      </Collapse>

      <SectionGroup>Замовлення</SectionGroup>

      <Collapse id="orders" summary="📋 Створення та редагування замовлень">
        <p>
          <strong>Сторінка /orders/</strong> — список замовлень з фільтрами по
          статусу та періоду (за замовчуванням — поточний місяць).
        </p>

        <H3>Нове замовлення</H3>
        <p>
          Кнопка <strong>«+ Замовлення»</strong> (десктоп) або плаваюча
          кнопка <strong>«+»</strong> внизу праворуч (мобільний).
        </p>
        <Step n={1}>
          <strong>Клієнт</strong> — оберіть існуючого зі списку або натисніть
          «Створити «...»» внизу, щоб додати нового. Якщо у клієнта є телефон
          чи адреса — підставляться автоматично.
        </Step>
        <Step n={2}>
          <strong>Телефон</strong> — опціонально. Якщо не задано в клієнта —
          при збереженні буде backfill'нуто у картку клієнта.
        </Step>
        <Step n={3}>
          <strong>Позиції</strong> — товар, категорія (income), ціна (грн) і
          кількість (шт). Можна додати кілька позицій кнопкою «+ Додати
          позицію». Якщо товару чи категорії немає в довіднику — створіть
          інлайн (див. секції «Категорії» і «Товари»).
        </Step>
        <Step n={4}>
          <strong>Доставити до</strong> — дедлайн (опц.). Прострочені активні
          замовлення помічаються червоним.
        </Step>
        <Step n={5}>
          <strong>Доставка</strong>, <strong>фото</strong>,{" "}
          <strong>нотатки</strong> — за потреби (див. окремі секції).
        </Step>

        <H3>Статуси та lifecycle</H3>
        <p>Можливі переходи:</p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Нове</strong> → щойно створене, потребує підтвердження
          </li>
          <li>
            <strong>Підтверджено</strong> → клієнт погодив, замовлення в черзі
          </li>
          <li>
            <strong>В роботі</strong> → виготовляється
          </li>
          <li>
            <strong>Готове до видачі</strong> → зібране, чекає на клієнта
            (ще активне, транзакцій нема)
          </li>
          <li>
            <strong>Виконано</strong> → завершене. При переході в цей статус
            автоматично створюються транзакції доходу (по одній на кожну
            позицію), а якщо доставка платна — окрема transaction «Доставка».
          </li>
        </ul>
        <Callout tone="amber">
          При переході <strong>Виконано → інший статус</strong> створені
          транзакції <strong>НЕ</strong> видаляються — їх треба прибрати
          вручну зі сторінки /transactions/. Це навмисно: щоб уникнути
          випадкової втрати фінансових даних.
        </Callout>

        <H3>KPI на сторінці</H3>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Активні</strong> — кількість «Нове + Підтверджено + В
            роботі»
          </li>
          <li>
            <strong>Сума активних</strong> — загальна сума по активних
          </li>
          <li>
            <strong>Прострочено</strong> — активні з дедлайном у минулому
          </li>
        </ul>

        <H3>Фільтри та сортування</H3>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Таби статусів</strong> — Активні / Нове / В роботі /
            Готове до видачі / Виконано / Усі
          </li>
          <li>
            <strong>Період</strong> — Цей місяць (за замовчуванням) /
            Квартал / Цей рік / Весь час / кастомний діапазон
          </li>
          <li>
            <strong>Пошук</strong> — по клієнту, товару, нотатці
          </li>
          <li>
            <strong>Сортування</strong> (десктоп) — За статусом, Спочатку
            нові, Дата доставки ↑/↓
          </li>
        </ul>
      </Collapse>

      <Collapse id="delivery" summary="🚚 Доставка">
        <p>У формі замовлення секція «Доставка (опц.)»:</p>

        <H3>Спосіб доставки</H3>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Нова Пошта</strong>, <strong>Укрпошта</strong>,{" "}
            <strong>Meest Express</strong> — підтримують ТТН. Для них доступне
            поле трекінгу і кнопка-лінк у картці замовлення.
          </li>
          <li>
            <strong>Кур'єр</strong>, <strong>Самовивіз</strong>,{" "}
            <strong>Інше</strong> — без ТТН.
          </li>
        </ul>

        <H3>Адреса</H3>
        <p>
          Підставляється з картки клієнта, якщо там є. Із заповненої адреси на
          картці замовлення з'являється кнопка <strong>«Маршрут»</strong> —
          відкриває Google Maps з прокладеним маршрутом.
        </p>

        <H3>Платна доставка</H3>
        <p>
          Якщо вказано <strong>«Вартість»</strong> &gt; 0, з'являється
          селектор <strong>«Хто платить»</strong>:
        </p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Платить клієнт</strong> → при завершенні замовлення
            створюється окрема income-транзакція «Доставка» на цю суму.
          </li>
          <li>
            <strong>Платимо ми</strong> → створюється expense-транзакція
            «Доставка» (зменшить прибуток).
          </li>
        </ul>
      </Collapse>

      <Collapse
        id="photos-voice"
        summary="📷 Фото · 🎙 Голосовий ввід · 💬 Коментарі"
      >
        <H3>Фото</H3>
        <p>
          До замовлення можна прикріпити до <strong>5 фото</strong>. Кожне
          конвертується в JPEG і зберігається інлайн у документі Firestore
          (base64). Клік по фото в картці — відкриває lightbox.
        </p>
        <p className="text-sm text-muted-foreground">
          Поради: великі фото знизьте до &lt;500КБ перед додаванням —
          Firestore має ліміт ~1МБ на документ, і занадто великі вкладення
          можуть викликати помилку «exceeds maximum».
        </p>

        <H3>Голосовий ввід</H3>
        <p>
          Кнопка <strong>🎙</strong> у заголовку /orders/ — продиктуйте
          замовлення вільним текстом. AI розпарсить клієнта, телефон, товари,
          кількості, доставку і відкриє наполовину заповнену форму. Перевірте
          і збережіть.
        </p>
        <p className="text-sm text-muted-foreground">
          Якщо клієнта зі знайденим іменем уже є в базі — він підставиться
          автоматично. Інакше у банері з'явиться список кандидатів — клікніть
          потрібного або «Створити нового» прямо у формі.
        </p>

        <H3>Коментарі</H3>
        <p>
          На картці замовлення можна вести нитку коментарів — корисно для
          спілкування з командою (попросити доукомплектувати, попередити про
          нестандартне пакування і т.д.). Лічильник 💬 показує кількість
          повідомлень у замовленні.
        </p>
      </Collapse>

      <SectionGroup>Фінанси</SectionGroup>

      <Collapse id="transactions" summary="💸 Транзакції">
        <p>
          <code>/transactions/</code> — журнал руху коштів. Два типи:{" "}
          <strong>Дохід</strong> (income) та <strong>Витрата</strong>{" "}
          (expense).
        </p>

        <H3>Створення</H3>
        <Step n={1}>
          Оберіть тип (Дохід / Витрата) — від нього залежать доступні
          категорії.
        </Step>
        <Step n={2}>
          <strong>Категорія</strong> — обов'язкова (з довідника або інлайн
          створення).
        </Step>
        <Step n={3}>
          <strong>Товар</strong> (опц.) — для income; з'являється у звітах
          «Топ товарів».
        </Step>
        <Step n={4}>
          <strong>Постачальник / Клієнт</strong> (опц.) — для зв'язку з
          довідником.
        </Step>
        <Step n={5}>
          <strong>Ціна</strong>, <strong>кількість</strong>,{" "}
          <strong>дата</strong> (за замовч. — зараз).
        </Step>

        <H3>Фільтри</H3>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Тип</strong> — Усі / Дохід / Витрата
          </li>
          <li>
            <strong>Категорія</strong> — будь-яка з довідника
          </li>
          <li>
            <strong>Період</strong> — Цей місяць (за замовч.) / Квартал /
            Цей рік / Весь час / кастомний
          </li>
          <li>
            <strong>Пошук</strong> — по категорії, товару, постачальнику,
            клієнту, нотатці
          </li>
        </ul>

        <H3>Авто-транзакції від замовлень</H3>
        <p>
          При переведенні замовлення в статус <strong>«Виконано»</strong>{" "}
          автоматично створюються транзакції доходу — по одній на кожну
          позицію замовлення. У нотатці буде посилання на номер замовлення.
          Якщо доставка платна — додатково створюється окрема транзакція
          «Доставка» (income якщо платить клієнт, expense якщо ми).
        </p>
      </Collapse>

      <Collapse id="analytics" summary="📊 Аналітика">
        <p>
          <code>/analytics/</code> — зведення продажів і витрат у вибраному
          періоді. Включає:
        </p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Виторг / витрати / прибуток</strong> — KPI за період
          </li>
          <li>
            <strong>Топ товарів</strong> — найприбутковіші позиції; клік
            провалює у /transactions/ з фільтром по конкретному товару
          </li>
          <li>
            <strong>Розбивка по категоріях</strong> — куди йдуть гроші
          </li>
          <li>
            <strong>Динаміка</strong> — графік по днях / тижнях / місяцях
          </li>
        </ul>
      </Collapse>

      <SectionGroup>Довідники</SectionGroup>

      <Collapse id="categories" summary="🏷 Категорії — як додати і налаштувати">
        <p>
          Категорія — це «папка» для замовлення чи транзакції. Колір
          категорії відображається у бейджах і використовується у графіках
          аналітики.
        </p>

        <H3>Два типи категорій</H3>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Дохід (income)</strong> — використовуються у замовленнях і
            income-транзакціях (продаж варення, доставка-від-клієнта, тощо).
          </li>
          <li>
            <strong>Витрата (expense)</strong> — лише у expense-транзакціях
            (закупівля сировини, оренда, пакування, доставка-за-наш-кошт).
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          У формі замовлення доступні <strong>тільки income</strong>{" "}
          категорії — продажі завжди дохід.
        </p>

        <H3>Створити через довідник</H3>
        <Step n={1}>
          Відкрийте <strong>/settings/categories/</strong> — список усіх
          категорій з кольоровими маркерами і фільтром по типу.
        </Step>
        <Step n={2}>
          Кнопка <strong>«+ Категорія»</strong> → задайте назву, тип (дохід
          або витрата) і виберіть колір з палітри (10 заготовлених + custom).
        </Step>
        <Step n={3}>Збережіть. Категорія одразу доступна у всіх формах.</Step>
        <p className="text-sm text-muted-foreground">
          Щоб <strong>відредагувати</strong> — клік по рядку. Видалення —
          через меню «⋮» (категорія не видалиться, якщо вона десь
          використовується; спершу зніміть прив'язки).
        </p>

        <H3>Створити inline з форми</H3>
        <p>
          У формі замовлення / транзакції в полі «Категорія» почніть друкувати
          назву → внизу попапа з'явиться кнопка{" "}
          <strong>«+ Створити «...»»</strong>. Клік — і категорія одразу
          створюється та підставляється.
        </p>
        <Callout tone="violet">
          Inline-створена з форми замовлення категорія автоматично має тип{" "}
          <strong>income</strong>, з форми expense-транзакції —{" "}
          <strong>expense</strong>. Колір — фіолетовий за замовчуванням,
          змінити можна пізніше у /settings/categories/.
        </Callout>
      </Collapse>

      <Collapse id="products" summary="📦 Товари — як додати і налаштувати">
        <p>
          Товар — позиція з прайс-листа. Поля:
        </p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Назва</strong> — обов'язкова
          </li>
          <li>
            <strong>Одиниця</strong> — шт / кг / уп. / банка / тощо (за
            замовч. «шт»)
          </li>
          <li>
            <strong>Ціна за замовч.</strong> — підставляється у форму
            замовлення при виборі товару (можна перевизначити для конкретного
            замовлення)
          </li>
          <li>
            <strong>Категорія за замовч.</strong> — теж підставляється
            автоматично у позицію замовлення / транзакцію
          </li>
        </ul>

        <H3>Створити через довідник</H3>
        <Step n={1}>
          Відкрийте <strong>/settings/products/</strong> — список з пошуком
          по назві.
        </Step>
        <Step n={2}>
          Кнопка <strong>«+ Товар»</strong> → заповніть поля. Пошук категорії
          у селекторі.
        </Step>
        <Step n={3}>Збережіть.</Step>

        <H3>Створити inline з форми замовлення / транзакції</H3>
        <p>
          У полі «Товар» почніть друкувати назву → внизу попапа з'явиться{" "}
          <strong>«+ Створити «...»»</strong>. Клік — товар створюється з
          одиницею «шт» і без ціни/категорії за замовч. Категорію
          інлайн-створеного товару можна потім задати у /settings/products/,
          щоб наступного разу не вибирати вручну.
        </p>

        <H3>Як товар впливає на аналітику</H3>
        <p>
          Якщо у транзакції доходу прив'язаний товар — він підраховується у
          секції <strong>«Топ товарів»</strong> на дашборді й аналітиці. Без
          прив'язки до товару продаж все одно зараховується у виторг, але не
          потрапляє у топ.
        </p>
      </Collapse>

      <Collapse id="suppliers" summary="🚛 Постачальники">
        <p>
          <code>/settings/suppliers/</code> — магазини, фермери, агровіни, у
          кого закуповуємо сировину. Використовується у експенс-транзакціях
          для фільтрації звітів.
        </p>

        <H3>Створити</H3>
        <Step n={1}>
          /settings/suppliers/ → кнопка <strong>«+ Постачальник»</strong>.
        </Step>
        <Step n={2}>
          Назва (обов'язково), контакт (телефон/посилання, опц.), нотатки
          (опц.).
        </Step>
        <Step n={3}>Збережіть.</Step>

        <H3>Inline з форми витрати</H3>
        <p>
          У формі expense-транзакції в полі «Постачальник» можна вводити нову
          назву і створювати inline тим самим механізмом «+ Створити «...»».
        </p>
      </Collapse>

      <Collapse id="customers" summary="👤 Клієнти">
        <p>
          <code>/settings/customers/</code> — покупці продукції. Поля: ім'я,
          телефон, адреса, вік, джерело (звідки прийшов: Instagram, рекомендація
          тощо), нотатки.
        </p>

        <H3>Створити</H3>
        <Step n={1}>
          /settings/customers/ → <strong>«+ Клієнт»</strong> → заповніть
          поля.
        </Step>
        <Step n={2}>Збережіть.</Step>

        <H3>Inline з форми замовлення</H3>
        <p>
          Найшвидший спосіб — у полі «Клієнт» введіть нове ім'я і натисніть{" "}
          <strong>«+ Створити «...»»</strong>. Клієнт створюється з лише
          одним полем (ім'я), решту даних можна заповнити пізніше у
          /settings/customers/.
        </p>

        <H3>М'який backfill</H3>
        <Callout tone="violet">
          Коли ви створюєте замовлення для існуючого клієнта і вписуєте телефон
          чи адресу, які ще не задані у його картці — вони{" "}
          <strong>автоматично</strong> запишуться у клієнта при збереженні.
          Наступного разу будуть підставлятися самі. Існуючі значення
          ніколи не перезаписуються.
        </Callout>
      </Collapse>

      <SectionGroup>Інтеграції</SectionGroup>

      <Collapse id="import" summary="📥 Імпорт з Excel">
        <p>
          <code>/settings/import/</code> — імпорт історії транзакцій з .xlsx.
          Корисно для першого завантаження старих даних з електронної таблиці.
        </p>
        <p className="text-sm text-muted-foreground">
          Перед імпортом переконайтесь, що довідники категорій і товарів
          заповнені — інакше у файлі мають бути точні назви, які створяться
          автоматично.
        </p>
      </Collapse>

      <Collapse id="notifications" summary="🔔 Telegram-сповіщення">
        <p>
          <code>/settings/notifications/</code> — підключення особистого
          Telegram-чату до бота <strong>@lavanda_oblik_bot</strong>.
        </p>
        <Step n={1}>
          Натисніть «Підключити Telegram» — відкриється бот з deep-link'ом.
        </Step>
        <Step n={2}>
          У боті натисніть <code>/start</code> — Chat ID збережеться у вашому
          акаунті.
        </Step>
        <Step n={3}>
          Натисніть <strong>«Тестове повідомлення»</strong>, щоб перевірити
          канал.
        </Step>
        <p>Які події надсилаються:</p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Нове замовлення</strong> — всім адмінам з підключеним
            Telegram
          </li>
          <li>
            <strong>Зміна статусу</strong> — теж усім адмінам
          </li>
          <li>
            <strong>Реєстрація нового користувача</strong> — адмінам, плюс у
            загальний канал (якщо налаштовано)
          </li>
        </ul>
      </Collapse>

      <SectionGroup>Доступ і безпека</SectionGroup>

      <Collapse id="users" summary="👥 Користувачі та ролі">
        <p>Доступ до додатку — лише з підтвердженою роллю.</p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>seller</strong> — продавець. Бачить дашборд, замовлення,
            транзакції, аналітику. Створює і редагує замовлення.
          </li>
          <li>
            <strong>admin</strong> — повний доступ + керування довідниками,
            імпорт, налаштування користувачів.
          </li>
          <li>
            <strong>super-owner</strong> — суперадмін. Може видаляти інших
            admin/seller; інших super-owner — ні.
          </li>
          <li>
            <strong>(без ролі)</strong> — нова реєстрація. Користувач бачить
            «Очікування доступу», доки admin не призначить роль на{" "}
            <code>/settings/users/</code>.
          </li>
        </ul>
        <Callout tone="violet">
          При появі нового користувача всі admin'и отримують Telegram (якщо
          підключений) — можна одразу зайти і призначити роль.
        </Callout>
      </Collapse>

      <Collapse id="data" summary="🔐 Дані та безпека">
        <p>
          Усі дані зберігаються у <strong>Cloud Firestore</strong> (Google
          Cloud, проєкт <code>lavanda-oblik</code>). Синхронізація між
          пристроями — в реальному часі.
        </p>
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>Авторизація</strong> — Firebase Authentication (Google
            Sign-In).
          </li>
          <li>
            <strong>App Check</strong> — захист від несанкціонованих запитів
            через reCAPTCHA Enterprise.
          </li>
          <li>
            <strong>Security Rules</strong> — серверна перевірка ролей на
            кожен read/write.
          </li>
          <li>
            <strong>Audit fields</strong> — кожен документ зберігає{" "}
            <code>createdBy</code>, <code>updatedBy</code> з іменами та
            timestamp'ами.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Telegram-сповіщення йдуть через окремий backend-сервіс — токен бота
          ніколи не покидає сервер, frontend звертається лише до API через
          ключ.
        </p>
      </Collapse>

      <p className="pt-4 text-center text-xs text-muted-foreground">
        Не знайшли відповіді? Напишіть у Telegram-чат команди — і ми додамо
        пункт у довідку.
      </p>
    </main>
  );
}

function Collapse({
  id,
  summary,
  children,
  defaultOpen = false,
}: {
  id: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group scroll-mt-20 rounded-lg border bg-card shadow-sm transition-shadow open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span className="text-muted-foreground transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function SectionGroup({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 text-sm font-semibold text-foreground">{children}</h3>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="my-2 flex gap-3 text-sm">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
        {n}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "amber" | "violet";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200";
  return (
    <div className={`my-3 rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

function FeatureGrid({
  items,
}: {
  items: { title: string; desc: string }[];
}) {
  return (
    <div className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-md border bg-card p-3 text-sm"
        >
          <div className="font-medium">{it.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{it.desc}</div>
        </div>
      ))}
    </div>
  );
}
