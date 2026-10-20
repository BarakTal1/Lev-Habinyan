"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { applyImportAction, previewImportAction, type Preview } from "@/app/(app)/import/actions";
import { t } from "@/lib/labels";

export function ImportWizard() {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ buildings: number; created: number; items: number } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setResult(null);
    start(async () => setPreview(await previewImportAction(text)));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t.import.help}</p>
      <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#C3CAD8] bg-white font-semibold text-navy">
        {t.import.choose}
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {preview && !result && (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
          <h2 className="text-[17px] font-bold">{t.import.preview}</h2>
          {preview.buildings.length === 0 && <p className="text-muted">{t.import.empty}</p>}
          <ul className="flex flex-col gap-1">
            {preview.buildings.map((b) => (
              <li key={b.name} className="flex items-center justify-between">
                <span dir="auto">{b.name}</span>
                <span className={`rounded-md px-2 text-sm font-semibold ${b.isNew ? "bg-[#E3F4EA] text-[#1F7A47]" : "bg-[#EEF0F3] text-[#4A5468]"}`}>{b.isNew ? t.import.newBuilding : t.import.existing}</span>
              </li>
            ))}
          </ul>
          {preview.problems.length > 0 && (
            <div className="rounded-xl bg-[#FDF0DC] p-3 text-[#7A4A00]">
              <h3 className="font-bold">{t.import.problems}</h3>
              <ul className="mt-1 text-sm">{preview.problems.map((p, i) => <li key={i}>{t.import.row} {p.row} · {p.column} · {p.reason}</li>)}</ul>
            </div>
          )}
          <button disabled={pending || preview.buildings.length === 0} onClick={() => start(async () => setResult(await applyImportAction(csv)))} className="h-14 rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">{t.import.confirm}</button>
        </section>
      )}

      {result && (
        <section className="flex flex-col gap-2 rounded-2xl bg-white p-4" role="status">
          <h2 className="text-[17px] font-bold">{t.import.done}</h2>
          <p>{t.import.result(result.buildings, result.created, result.items)}</p>
          <Link href="/maintenance" className="flex h-12 items-center justify-center rounded-xl border border-navy font-semibold text-navy">{t.import.toCalendar}</Link>
        </section>
      )}
    </div>
  );
}
