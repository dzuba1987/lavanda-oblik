#!/usr/bin/env bash
# Запуск import_excel.py у власному venv.
#
#   ./run.sh --dry-run     # показати статистику без запису у Firestore
#   ./run.sh               # записати у Firestore
#
# Скрипт сам створює .venv і ставить залежності з requirements.txt.
# Якщо pip не може достукатися до PyPI ([Errno -3] / Failed to establish a new
# connection) — це проблема мережі/DNS (часто captive-portal Wi-Fi або VPN),
# а не самого проєкту. Полагодь інтернет і запусти ще раз.

set -euo pipefail

cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
VENV=".venv"

if ! command -v "$PY" >/dev/null 2>&1; then
  echo "✗ Не знайдено $PY. Встанови Python 3 і повтори." >&2
  exit 1
fi

# ── venv ────────────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "→ Створюю venv ($VENV)…"
  "$PY" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

# ── Залежності (з ретраями на випадок флапу мережі) ──────────────────────────
# Чи всі пакети вже стоять? Якщо так — не ходимо в мережу взагалі.
deps_ok() {
  python - <<'PY' 2>/dev/null
import odf, google.cloud.firestore, google.oauth2  # noqa: F401
PY
}

pip_with_retries() {
  local n=0 max=4 delay=2
  until python -m pip "$@"; do
    n=$((n + 1))
    if [ "$n" -ge "$max" ]; then
      cat >&2 <<'MSG'

✗ pip не зміг встановити залежності.
  Найімовірніше — немає доступу до PyPI (DNS/мережа). Перевір:
    ping -c 2 pypi.org
    curl -I https://pypi.org
  Часті причини: captive-portal Wi-Fi (зайди в браузер і залогінься),
  увімкнений VPN, або корпоративний проксі (export HTTPS_PROXY=...).
MSG
      return 1
    fi
    echo "  …збій мережі, повтор $n/$max через ${delay}s" >&2
    sleep "$delay"
    delay=$((delay * 2))
  done
}

if deps_ok; then
  echo "→ Залежності вже встановлені."
else
  echo "→ Встановлюю залежності…"
  pip_with_retries install --upgrade pip || true   # апгрейд pip не критичний
  pip_with_retries install -r requirements.txt
fi

# ── Перевірка вхідних файлів ─────────────────────────────────────────────────
ODS="../Продажі-Витрати КВІТИ.ods"
SA="../../-invest-notify/storage/app/firebase/lavanda-service-account.json"
[ -f "$ODS" ] || echo "⚠ Не знайдено ODS: $ODS" >&2
# SA потрібен лише для реального запису (не для --dry-run)
if [ ! -f "$SA" ] && [[ " $* " != *" --dry-run "* ]]; then
  echo "⚠ Не знайдено service-account: $SA (потрібен для запису у Firestore)" >&2
fi

# ── Запуск ───────────────────────────────────────────────────────────────────
echo "→ python import_excel.py $*"
exec python import_excel.py "$@"
