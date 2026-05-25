"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";
import { parseWorkbook } from "@/lib/excel/parseWorkbook";
import { runImport, type ImportProgress, type ImportSummary } from "@/lib/excel/runImport";
import { formatMoney, formatDate } from "@/lib/utils/format";
import type { WorkbookParseResult, SheetParseResult } from "@/lib/excel/types";

type Phase = "idle" | "parsing" | "preview" | "importing" | "done";

export function ImportWizard() {
  const { authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [parseResult, setParseResult] = useState<WorkbookParseResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFile(file: File) {
    setPhase("parsing");
    setParseResult(null);
    setSummary(null);
    try {
      const result = await parseWorkbook(file);
      setParseResult(result);
      setPhase("preview");
      if (result.totalRows === 0) {
        toast.warning("Не знайдено жодного рядка для імпорту");
      } else {
        toast.success(
          `Знайдено ${result.totalRows} рядків у ${result.sheets.length} аркушах`
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось прочитати файл");
      setPhase("idle");
    }
  }

  async function handleConfirmImport() {
    if (!authUser || !parseResult) return;
    setConfirmOpen(false);
    setPhase("importing");
    const allRows = parseResult.sheets.flatMap((s) => s.rows);
    try {
      const result = await runImport(allRows, authUser.uid, (p) => {
        setProgress(p);
      });
      setSummary(result);
      setPhase("done");
      toast.success(`Імпортовано ${result.transactionsCreated} транзакцій`);
    } catch (e) {
      console.error(e);
      toast.error("Помилка під час імпорту");
      setPhase("preview");
    }
  }

  function reset() {
    setPhase("idle");
    setParseResult(null);
    setProgress(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {phase === "idle" && <DropZone onClick={handlePickFile} />}

      {phase === "parsing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-sm text-muted-foreground">
              Парсимо аркуші…
            </p>
          </CardContent>
        </Card>
      )}

      {phase === "preview" && parseResult && (
        <Preview
          result={parseResult}
          onCancel={reset}
          onConfirm={() => setConfirmOpen(true)}
        />
      )}

      {phase === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            <div className="text-center text-sm">
              <div className="font-medium">
                {progress?.message ?? "Імпортуємо…"}
              </div>
              {progress && progress.total > 0 && (
                <div className="mt-1 text-muted-foreground tabular-nums">
                  {progress.written} / {progress.total}
                </div>
              )}
            </div>
            {progress && progress.total > 0 && (
              <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${(progress.written / progress.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "done" && summary && (
        <DoneCard summary={summary} onReset={reset} />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Підтвердити імпорт?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Буде додано{" "}
              <span className="font-semibold">
                {parseResult?.totalRows ?? 0}
              </span>{" "}
              транзакцій. Дублі НЕ перевіряються — якщо ви вже імпортували цей
              файл, у БД будуть копії.
            </p>
            <p className="text-muted-foreground">
              Дія не зворотна — щоб відкотити, доведеться видалити транзакції
              вручну через сторінку «Транзакції».
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Скасувати
            </Button>
            <Button
              onClick={handleConfirmImport}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Імпортувати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DropZone({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card px-6 py-12 text-center transition-colors hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-950/20"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
        <Upload className="h-7 w-7" />
      </div>
      <div>
        <div className="text-base font-medium">Оберіть .xlsx файл</div>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Парсер очікує аркуші «Витрати YYYY» та «Продажі YYYY». Файл читається
          у вашому браузері — нічого не надсилається на сервер до підтвердження.
        </p>
      </div>
    </button>
  );
}

function Preview({
  result,
  onCancel,
  onConfirm,
}: {
  result: WorkbookParseResult;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const firstSheetName = result.sheets[0]?.sheet;
  const [activeSheet, setActiveSheet] = useState(firstSheetName);

  return (
    <div className="space-y-4">
      <SummaryRow result={result} />

      {result.unknownSheets.length > 0 && (
        <Card>
          <CardContent className="flex items-start gap-3 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="font-medium">Нерозпізнані аркуші</div>
              <div className="text-muted-foreground">
                {result.unknownSheets.join(", ")} — пропущено. Парсер шукає
                аркуші з назвами «Витрати …», «Продажі …», «Словник».
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result.sheets.length > 0 && activeSheet && (
        <Tabs value={activeSheet} onValueChange={setActiveSheet}>
          <TabsList className="flex w-full flex-wrap">
            {result.sheets.map((s) => (
              <TabsTrigger key={s.sheet} value={s.sheet} className="text-xs">
                {s.type === "income" ? (
                  <ArrowDownToLine className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowUpFromLine className="mr-1 h-3 w-3" />
                )}
                {s.sheet}
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {s.rows.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {result.sheets.map((s) => (
            <TabsContent key={s.sheet} value={s.sheet}>
              <SheetPreview sheet={s} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <div className="sticky bottom-20 z-10 flex gap-2 md:bottom-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Скасувати
        </Button>
        <Button
          onClick={onConfirm}
          disabled={result.totalRows === 0}
          className="flex-1 bg-violet-600 hover:bg-violet-700"
        >
          Імпортувати {result.totalRows}{" "}
          {pluralize(result.totalRows, "запис", "записи", "записів")}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ result }: { result: WorkbookParseResult }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card>
        <CardContent className="px-3 py-3">
          <div className="text-xs text-muted-foreground">Знайдено</div>
          <div className="text-lg font-semibold">{result.totalRows}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-3 py-3">
          <div className="text-xs text-muted-foreground">Аркушів</div>
          <div className="text-lg font-semibold">{result.sheets.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-3 py-3">
          <div className="text-xs text-muted-foreground">Пропущено</div>
          <div
            className={cn(
              "text-lg font-semibold",
              result.totalSkipped > 0
                ? "text-amber-600 dark:text-amber-400"
                : ""
            )}
          >
            {result.totalSkipped}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SheetPreview({ sheet }: { sheet: SheetParseResult }) {
  const previewRows = sheet.rows.slice(0, 10);
  const warnings = sheet.rows.filter((r) => r.warnings.length > 0);

  return (
    <div className="space-y-3">
      {sheet.skipped.length > 0 && (
        <Card>
          <CardContent className="space-y-1 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Пропущено {sheet.skipped.length} рядків
            </div>
            <ul className="max-h-32 overflow-y-auto pl-6 text-xs text-muted-foreground">
              {sheet.skipped.slice(0, 5).map((s, i) => (
                <li key={i}>
                  Рядок {s.rowNumber}: {s.reason}
                </li>
              ))}
              {sheet.skipped.length > 5 && (
                <li>… та ще {sheet.skipped.length - 5}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card>
          <CardContent className="py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {warnings.length}{" "}
              {pluralize(warnings.length, "запис", "записи", "записів")} з
              попередженнями
            </div>
            <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground">
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>
                  Рядок {w.rowNumber}: {w.warnings.join("; ")}
                </li>
              ))}
              {warnings.length > 5 && <li>…</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="border-b text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Категорія</th>
                  <th className="px-3 py-2 font-medium">Товар</th>
                  <th className="px-3 py-2 font-medium">
                    {sheet.type === "expense" ? "Постачальник" : "Клієнт"}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2">{row.categoryName}</td>
                    <td className="px-3 py-2">{row.productName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.counterpartyName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatMoney(row.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.rows.length > 10 && (
            <div className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
              … та ще {sheet.rows.length - 10}{" "}
              {pluralize(sheet.rows.length - 10, "запис", "записи", "записів")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DoneCard({
  summary,
  onReset,
}: {
  summary: ImportSummary;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <div>
          <h3 className="text-lg font-semibold">Імпорт завершено</h3>
          <p className="text-sm text-muted-foreground">
            Усі дані вже у Firestore
          </p>
        </div>
        <ul className="space-y-1 text-sm">
          <Stat label="Транзакцій" n={summary.transactionsCreated} />
          <Stat label="Категорій" n={summary.categoriesCreated} />
          <Stat label="Товарів" n={summary.productsCreated} />
          <Stat label="Постачальників" n={summary.suppliersCreated} />
          <Stat label="Клієнтів" n={summary.customersCreated} />
        </ul>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onReset}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Імпортувати ще
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, n }: { label: string; n: number }) {
  return (
    <li className="flex items-center justify-between gap-6 tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">+{n}</span>
    </li>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
