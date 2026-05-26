#!/usr/bin/env python3
"""
Імпорт продажів і витрат з Продажі-Витрати КВІТИ.ods → Firestore.

Стратегія:
  • Для продажів: кожен рядок з заповненим Найменуванням → 1 Transaction (income).
    Дата/клієнт forward-fill'аться зі шапки групи.
  • Для витрат: кожен рядок з сумою → 1 Transaction (expense).
    Дата/постачальник/категорія forward-fill'аться.
  • Customer/Supplier — створюються за потреби (idempotent по name).
  • Idempotency: поле `importedFrom = "{sheet}:{row}"`. Повторний запуск пропускає вже-імпортовані.

Запуск:
    python3 import_excel.py --dry-run        # показати статистику без запису
    python3 import_excel.py                  # записати у Firestore
"""

import sys
import re
import os
import argparse
from datetime import datetime, timezone, timedelta
from collections import Counter

from odf.opendocument import load
from odf.table import Table, TableRow, TableCell
from odf.text import P
from google.cloud import firestore
from google.oauth2 import service_account

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ODS_PATH = os.path.join(SCRIPT_DIR, "..", "Продажі-Витрати КВІТИ.ods")
SA_PATH = os.path.join(SCRIPT_DIR, "..", "..", "invest-notify",
                       "storage", "app", "firebase", "lavanda-service-account.json")

# UID адміна (Олександр) — використовується як createdBy
CREATED_BY_UID = "hxZYOFkyahdKIvmemGKdbVdeljw1"

# Київський час
TZ = timezone(timedelta(hours=2))


# ── Парсер ODS ─────────────────────────────────────────────────────────────

def cell_value(cell):
    parts = []
    for p in cell.getElementsByType(P):
        parts.append(''.join(t.data for t in p.childNodes if t.nodeType == 3))
    txt = '\n'.join(parts).strip()
    val_type = cell.getAttribute('valuetype')
    value = cell.getAttribute('value')
    date_value = cell.getAttribute('datevalue')
    if val_type == 'float' and value:
        try: return float(value)
        except: pass
    if val_type == 'date' and date_value:
        return date_value
    return txt or None


def row_values(row, max_cols=12):
    out = []
    for cell in row.getElementsByType(TableCell):
        repeat = int(cell.getAttribute('numbercolumnsrepeated') or 1)
        v = cell_value(cell)
        for _ in range(min(repeat, max_cols - len(out))):
            out.append(v)
            if len(out) >= max_cols: break
        if len(out) >= max_cols: break
    while len(out) < max_cols:
        out.append(None)
    return out


def parse_date_str(s):
    """`DD.MM.YY` / `DD.MM.YYYY` / ISO `YYYY-MM-DD` → datetime (UTC). None якщо невалідна."""
    if s is None: return None
    s = str(s).strip()
    if not s: return None
    # ISO
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        y, mo, d = map(int, m.groups())
        return datetime(y, mo, d, 12, 0, 0, tzinfo=TZ)
    # DD.MM.YY[YY]
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$', s)
    if m:
        d, mo, y = m.groups()
        y = int(y); d = int(d); mo = int(mo)
        if y < 100: y += 2000
        try:
            return datetime(y, mo, d, 12, 0, 0, tzinfo=TZ)
        except ValueError:
            return None
    return None


def parse_number(v):
    """Беремо ціле/float із value або з текстового рядка ('100' / '100,50' / '12 333')."""
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if not s: return None
    # пробуємо чистий number
    s_clean = s.replace(' ', '').replace(',', '.')
    try: return float(s_clean)
    except ValueError: pass
    # витягуємо першу числову частину (для випадків "771+70 дост")
    m = re.match(r'^[-+]?\d+([.,]\d+)?', s_clean)
    if m:
        try: return float(m.group(0).replace(',', '.'))
        except: return None
    return None


# ── Нормалізація для матчингу ─────────────────────────────────────────────

def normalize(s):
    if s is None: return ""
    s = str(s).strip().lower()
    # пробіл між числом і одиницею-обсягу: "180 мл" → "180мл"
    s = re.sub(r'(\d)\s+(мл|кг|г|л)\b', r'\1\2', s)
    # видалити "(...) люд.) " / "(N+ шт)" блоки в дужках — це опис, не назва
    s = re.sub(r'\s*\([^)]*люд[^)]*\)\s*', ' ', s)
    s = re.sub(r'\s*\([^)]*\d+\s*шт[^)]*\)\s*', ' ', s)
    # кінцеві суфікси-одиниці БЕЗ числа: ", шт" / ", год" / " шт"
    s = re.sub(r'[,\s]+(шт|год|люд\.?)\s*$', '', s)
    # дефіс / тире: уніфікувати
    s = re.sub(r'\s*[-–—]\s*', '-', s)
    s = re.sub(r'[\s,;]+', ' ', s)
    s = re.sub(r'\s*\.\s*', '', s)
    return s.strip()


# Аліаси: raw normalized → dict normalized.
PRODUCT_ALIASES = {
    "саженці": "саджанці лаванди",
    "саджанці": "саджанці лаванди",
    "цибулина гладіолуса 1 набір-20": "цибулина гладіолуса",     # Словник нормалізується у "цибулина гладіолуса"
    "цибулина гладіолуса 1 набір-20 шт": "цибулина гладіолуса",  # if нормалізатор не відсік шт
    "зрізана лаванда кг": "зрізана лаванда",
    # Нові товари (відсутні у Словнику) — лишимо без productId:
    #   букет лаванди, багаторічні квіти, гідролат троянди 100мл, статиця,
    #   кулінарна лаванда, гомфрена, букет лавандину, віночок, чай з лавандою,
    #   букет гіпсофіли, дідух, свічка, букет майорів
}


# ── Forward-fill ────────────────────────────────────────────────────────────

def forward_fill(rows, col_idx):
    """Повертає список (rowidx_in_sheet, row, ffillvalue) — рядок-індекс зі sheet'у (1-based, з шапкою)."""
    last = None
    out = []
    for i, r in enumerate(rows):
        v = r[col_idx] if col_idx < len(r) else None
        if v not in (None, ''):
            last = v
        out.append((i + 2, r, last))  # +2: 1-based + skip header
    return out


# ── Завантажуємо ODS і Firestore ────────────────────────────────────────────

print("→ Loading ODS…")
doc = load(ODS_PATH)
tables = {t.getAttribute('name'): t for t in doc.getElementsByType(Table)}

print("→ Connecting to Firestore…")
creds = service_account.Credentials.from_service_account_file(SA_PATH)
db = firestore.Client(project="lavanda-oblik", credentials=creds)


def load_dict(coll):
    return {d.id: d.to_dict() for d in db.collection(coll).stream()}


print("→ Reading existing collections…")
categories = load_dict("categories")
products = load_dict("products")
customers = load_dict("customers")
suppliers = load_dict("suppliers")

# Lookup maps (normalized name → id)
cat_by_name = {normalize(c["name"]): cid for cid, c in categories.items()}
prod_by_name = {normalize(p["name"]): pid for pid, p in products.items()}
cust_by_name = {normalize(c["name"]): cid for cid, c in customers.items()}
supp_by_name = {normalize(s["name"]): sid for sid, s in suppliers.items()}

# Existing transactions — щоб не дублювати при повторному запуску
existing_imports = set()
for d in db.collection("transactions").where("importedFrom", "!=", "").stream():
    src = d.to_dict().get("importedFrom")
    if src: existing_imports.add(src)

print(f"   {len(categories)} categories, {len(products)} products, "
      f"{len(customers)} customers, {len(suppliers)} suppliers")
print(f"   {len(existing_imports)} previously-imported transactions")


# ── Стратегії розв'язання ───────────────────────────────────────────────────

def resolve_product(name_raw):
    """→ (product_id, product_name, default_category_id, default_category_name)"""
    if not name_raw: return None, None, None, None
    norm = normalize(name_raw)
    if norm in PRODUCT_ALIASES:
        norm = PRODUCT_ALIASES[norm]
    pid = prod_by_name.get(norm)
    if not pid: return None, str(name_raw).strip(), None, None
    p = products[pid]
    cat_id = p.get("defaultCategoryId")
    cat_name = categories[cat_id]["name"] if cat_id and cat_id in categories else None
    return pid, p["name"], cat_id, cat_name


def resolve_category(name_raw, type_, fallback_id, fallback_name):
    """Знайти існуючу категорію по name; інакше повернути fallback."""
    if not name_raw:
        return fallback_id, fallback_name
    norm = normalize(name_raw)
    cid = cat_by_name.get(norm)
    if cid:
        return cid, categories[cid]["name"]
    return fallback_id, fallback_name


def get_or_create_customer(name_raw, source=None, age=None, dry_run=False):
    if not name_raw: return None, None
    name = str(name_raw).strip()
    norm = normalize(name)
    if norm in cust_by_name:
        return cust_by_name[norm], customers[cust_by_name[norm]]["name"]
    if dry_run:
        return f"<NEW:customer:{name}>", name
    ref = db.collection("customers").document()
    data = {
        "name": name,
        "age": age,
        "source": source,
        "notes": None,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "phone": None,  # required field — буде null
    }
    ref.set(data)
    customers[ref.id] = data
    cust_by_name[norm] = ref.id
    return ref.id, name


def get_or_create_supplier(name_raw, dry_run=False):
    if not name_raw: return None, None
    name = str(name_raw).strip()
    norm = normalize(name)
    if norm in supp_by_name:
        return supp_by_name[norm], suppliers[supp_by_name[norm]]["name"]
    if dry_run:
        return f"<NEW:supplier:{name}>", name
    ref = db.collection("suppliers").document()
    data = {
        "name": name,
        "contact": None,
        "notes": None,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    suppliers[ref.id] = data
    supp_by_name[norm] = ref.id
    return ref.id, name


# ── Імпорт продажів ─────────────────────────────────────────────────────────

def import_sales(sheet_name, dry_run):
    if sheet_name not in tables:
        return {"created": 0, "skipped": 0, "unmapped_products": Counter(), "no_date": 0}
    table = tables[sheet_name]
    all_rows = [row_values(r) for r in table.getElementsByType(TableRow)]
    rows = all_rows[1:]  # skip header

    ff_date = forward_fill(rows, 0)        # дата
    ff_client = forward_fill(rows, 1)      # клієнт

    created = skipped = no_date = 0
    unmapped = Counter()
    batches = []
    batch = db.batch()
    batch_size = 0

    for (rownum, raw, dt_ff), (_, _, client_ff) in zip(ff_date, ff_client):
        # Колонки: 0=Дата, 1=ПІП, 2=Категорія, 3=Найменування, 4=Ціна, 5=К-сть,
        #          6=Сума, 7=Звідки, 8=Вік, 9=Примітка
        product_raw = raw[3] if len(raw) > 3 else None
        total_raw = raw[6] if len(raw) > 6 else None
        if not product_raw and not total_raw:
            continue  # повністю порожній рядок

        unit_price = parse_number(raw[4] if len(raw) > 4 else None)
        quantity = parse_number(raw[5] if len(raw) > 5 else None)
        total = parse_number(total_raw)

        # Якщо нема ні товару, ні суми — skip
        if not product_raw and (total is None or total == 0):
            continue
        # Якщо є товар але без суми — рахуємо з ціна×к-сть
        if total is None and unit_price is not None and quantity is not None:
            total = unit_price * quantity
        if unit_price is None and total is not None and quantity:
            unit_price = total / quantity
        if quantity is None and total is not None and unit_price:
            quantity = total / unit_price
        # Якщо все одно щось None — дефолти
        if unit_price is None: unit_price = total or 0
        if quantity is None:   quantity = 1
        if total is None:      total = unit_price * quantity

        if total <= 0:
            continue  # сума 0 — імпорт без сенсу

        date = parse_date_str(dt_ff)
        if date is None:
            no_date += 1
            continue  # не імпортуємо без дати

        import_key = f"{sheet_name}:{rownum}"
        if import_key in existing_imports:
            skipped += 1
            continue

        # Резолвимо товар → категорію
        pid, pname, cat_id_from_prod, cat_name_from_prod = resolve_product(product_raw)
        if product_raw and not pid:
            unmapped[str(product_raw).strip()] += 1

        # Якщо product не знайдено — пробуємо взяти категорію з рядка (зазвичай порожня)
        cat_raw = raw[2] if len(raw) > 2 else None
        cat_id, cat_name = resolve_category(
            cat_raw, "income",
            cat_id_from_prod, cat_name_from_prod
        )
        # Якщо все одно немає категорії — кидаємо у «Інші товари»
        if not cat_id:
            fallback_cid = cat_by_name.get("інші товари")
            if fallback_cid:
                cat_id = fallback_cid
                cat_name = categories[fallback_cid]["name"]

        if not cat_id:
            # без категорії взагалі не пишемо — порушує rules
            skipped += 1
            continue

        # Клієнт + його джерело/вік (якщо є)
        source = raw[7] if len(raw) > 7 else None
        age_raw = raw[8] if len(raw) > 8 else None
        age = None
        if age_raw is not None:
            n = parse_number(age_raw)
            if n is not None and 10 <= n <= 110:
                age = int(n)
        cust_id, cust_name = get_or_create_customer(client_ff, source=source, age=age, dry_run=dry_run)

        # Примітка
        note_raw = raw[9] if len(raw) > 9 else None
        note = str(note_raw).strip() if note_raw else None

        tx_doc = {
            "date": date,
            "type": "income",
            "categoryId": cat_id,
            "categoryName": cat_name or "",
            "productId": pid,
            "productName": pname,
            "supplierId": None,
            "supplierName": None,
            "customerId": cust_id if (cust_id and not str(cust_id).startswith("<NEW")) else None,
            "customerName": cust_name,
            "unitPrice": float(unit_price),
            "quantity": float(quantity),
            "totalAmount": float(total),
            "note": note,
            "createdBy": CREATED_BY_UID,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "importedFrom": import_key,
        }

        if dry_run:
            created += 1
            continue

        ref = db.collection("transactions").document()
        batch.set(ref, tx_doc)
        batch_size += 1
        created += 1
        if batch_size >= 400:
            batch.commit()
            batch = db.batch()
            batch_size = 0

    if not dry_run and batch_size > 0:
        batch.commit()

    return {"created": created, "skipped": skipped, "no_date": no_date, "unmapped_products": unmapped}


# ── Імпорт витрат ───────────────────────────────────────────────────────────

def import_expenses(sheet_name, dry_run):
    if sheet_name not in tables:
        return {"created": 0, "skipped": 0, "unmapped_categories": Counter(), "no_date": 0}
    table = tables[sheet_name]
    all_rows = [row_values(r) for r in table.getElementsByType(TableRow)]
    rows = all_rows[1:]

    ff_date = forward_fill(rows, 0)
    ff_supplier = forward_fill(rows, 1)
    ff_cat = forward_fill(rows, 2)

    created = skipped = no_date = 0
    unmapped = Counter()
    batch = db.batch()
    batch_size = 0

    fallback_cid = cat_by_name.get(normalize("Інші адміністративні витрати"))
    fallback_name = categories[fallback_cid]["name"] if fallback_cid else None

    for (rownum, raw, dt_ff), (_, _, supp_ff), (_, _, cat_ff) in zip(ff_date, ff_supplier, ff_cat):
        # Колонки: 0=Дата, 1=Постачальник, 2=Категорія, 3=Найменування, 4=Ціна, 5=К-сть, 6=Сума, 7=Примітка
        total_raw = raw[6] if len(raw) > 6 else None
        unit_price = parse_number(raw[4] if len(raw) > 4 else None)
        quantity = parse_number(raw[5] if len(raw) > 5 else None)
        total = parse_number(total_raw)

        # порожні рядки
        if (total is None or total == 0) and not raw[3]:
            continue

        if total is None and unit_price is not None and quantity is not None:
            total = unit_price * quantity
        if unit_price is None: unit_price = total or 0
        if quantity is None:   quantity = 1
        if total is None:      total = unit_price * quantity

        if total <= 0:
            continue

        date = parse_date_str(dt_ff)
        if date is None:
            no_date += 1
            continue

        import_key = f"{sheet_name}:{rownum}"
        if import_key in existing_imports:
            skipped += 1
            continue

        cat_id, cat_name = resolve_category(cat_ff, "expense", fallback_cid, fallback_name)
        if cat_ff and not cat_by_name.get(normalize(cat_ff)):
            unmapped[str(cat_ff).strip()] += 1
        if not cat_id:
            skipped += 1
            continue

        supp_id, supp_name = get_or_create_supplier(supp_ff, dry_run=dry_run)

        note_raw = raw[7] if len(raw) > 7 else None
        note_combined = []
        if raw[3]: note_combined.append(str(raw[3]).strip())
        if note_raw: note_combined.append(str(note_raw).strip())
        note = " · ".join(note_combined) if note_combined else None

        tx_doc = {
            "date": date,
            "type": "expense",
            "categoryId": cat_id,
            "categoryName": cat_name or "",
            "productId": None,
            "productName": str(raw[3]).strip() if raw[3] else None,
            "supplierId": supp_id if (supp_id and not str(supp_id).startswith("<NEW")) else None,
            "supplierName": supp_name,
            "customerId": None,
            "customerName": None,
            "unitPrice": float(unit_price),
            "quantity": float(quantity),
            "totalAmount": float(total),
            "note": note,
            "createdBy": CREATED_BY_UID,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "importedFrom": import_key,
        }

        if dry_run:
            created += 1
            continue

        ref = db.collection("transactions").document()
        batch.set(ref, tx_doc)
        batch_size += 1
        created += 1
        if batch_size >= 400:
            batch.commit()
            batch = db.batch()
            batch_size = 0

    if not dry_run and batch_size > 0:
        batch.commit()

    return {"created": created, "skipped": skipped, "no_date": no_date, "unmapped_categories": unmapped}


# ── Main ───────────────────────────────────────────────────────────────────

ap = argparse.ArgumentParser()
ap.add_argument("--dry-run", action="store_true")
args = ap.parse_args()

mode = "DRY-RUN" if args.dry_run else "WRITING"
print(f"\n=== {mode} ===\n")

total_created = total_skipped = 0
all_unmapped_products = Counter()
all_unmapped_cats = Counter()

for sheet in ["Продажі 2024", "Продажі 2025", "Продажі 2026"]:
    r = import_sales(sheet, args.dry_run)
    print(f"{sheet}: created={r['created']}, skipped={r['skipped']}, no_date={r['no_date']}")
    total_created += r["created"]; total_skipped += r["skipped"]
    all_unmapped_products.update(r["unmapped_products"])

for sheet in ["Витрати 2024", "Витрати 2025", "Витрати 2026"]:
    r = import_expenses(sheet, args.dry_run)
    print(f"{sheet}: created={r['created']}, skipped={r['skipped']}, no_date={r['no_date']}")
    total_created += r["created"]; total_skipped += r["skipped"]
    all_unmapped_cats.update(r["unmapped_categories"])

print(f"\n=== Summary ===")
print(f"Total {'would be ' if args.dry_run else ''}created: {total_created}")
print(f"Total skipped: {total_skipped}")

if all_unmapped_products:
    print(f"\nUnmapped products ({len(all_unmapped_products)}, top 15):")
    for n, c in all_unmapped_products.most_common(15):
        print(f"  {c:4d}  {n}")
if all_unmapped_cats:
    print(f"\nUnmapped expense categories ({len(all_unmapped_cats)}):")
    for n, c in all_unmapped_cats.most_common():
        print(f"  {c:4d}  {n}")
