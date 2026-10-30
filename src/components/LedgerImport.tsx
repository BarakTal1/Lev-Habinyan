"use client";
import { useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { applyApartmentsAction, applyLedgerImportAction, previewApartmentsAction, previewLedgerImportAction } from "@/app/(app)/import/actions";
import type { ApartmentsPreview } from "@/lib/db/tenants";
import type { ImportPreview, ImportSource } from "@/lib/db/ledger";
import { readGrid } from "@/lib/import/readFile";
import { t } from "@/lib/labels";

const L = t.ledgerImport;
type Kind = "apartments" | "tariffs" | "payments";

/** A CSV with a byte order mark, so Excel opens the Hebrew headers correctly. */
function templateCsv(kind: Kind, year: number): string {
  const header = kind === "apartments"
    ? ["דירה", "קומה", "בעלים", "טלפון בעלים", "אימייל בעלים", "שוכר", "טלפון שוכר", "אימייל שוכר", "משלם", "דמי ועד"]
    : kind === "tariffs"
      ? ["דירה", "שם דייר", ...Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}/${year}`)]
      : ["דירה", "סכום", "תאריך תשלום", "חודש", "אמצעי תשלום", "אסמכתא"];
  return "﻿" + header.join(",") + "\n";
}

/** Import of monthly tariffs or payments for one building: choose the file, see the changes, then confirm. */
export function LedgerImport({ kind, buildings, year }: { kind: Kind; buildings: { id: string; name: string }[]; year: number }) {
  const [buildingId, setBuildingId] = useState("");
  const [source, setSource] = useState<ImportSource>("excel");
  const [file, setFile] = useState<{ name: string; grid: string[][] } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [aptPreview, setAptPreview] = useState<ApartmentsPreview | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onFile(f: File | undefined, input: HTMLInputElement) {
    if (!f || !buildingId) return;
    setDone(false);
    setError("");
    start(async () => {
      try {
        const grid = await readGrid(f);
        setFile({ name: f.name, grid });
        if (kind === "apartments") setAptPreview(await previewApartmentsAction(buildingId, grid));
        else setPreview(await previewLedgerImportAction(kind, buildingId, grid, source));
      } catch {
        setError(L.failed);
      }
      // Let the same file be chosen again: a second import of one file must be possible (and must add nothing).
      input.value = "";
    });
  }

  function apply() {
    if (!file) return;
    start(async () => {
      try {
        if (kind === "apartments") await applyApartmentsAction(buildingId, file.grid);
        else await applyLedgerImportAction(kind, buildingId, file.name, file.grid, source);
        setDone(true);
        setPreview(null);
        setAptPreview(null);
      } catch {
        setError(L.failed);
      }
    });
  }

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(kind, year))}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{L.help[kind]}</p>
      <a href={template} download={`${L.kinds[kind]}.csv`} className="inline-flex h-10 w-fit items-center gap-1 font-semibold text-brand"><Icon name="upload_file" size={20} />{L.template}</a>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={L.building}>
          <select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setPreview(null); setAptPreview(null); }} className={inputCls}>
            <option value="">{L.pickBuilding}</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {kind !== "apartments" && <Field label={L.source}>
          <select value={source} onChange={(e) => { setSource(e.target.value as ImportSource); setPreview(null); }} className={inputCls}>
            <option value="excel">{L.sources.excel}</option>
            <option value="bllink_import">{L.sources.bllink_import}</option>
          </select>
        </Field>}
      </div>
      <label className={`flex h-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#C3CAD8] bg-white font-semibold text-navy ${buildingId ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
        {L.choose}
        <input type="file" accept=".csv,.xlsx,text/csv" disabled={!buildingId || pending} className="sr-only" onChange={(e) => onFile(e.target.files?.[0], e.currentTarget)} />
      </label>
      {error && <p role="alert" className="text-[#B3261E]">{error}</p>}

      {preview && (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-[17px] font-bold">{t.import.preview}</h2>
          <p className="text-[15px]">{L.counts(preview.added, preview.changed, preview.unchanged)}</p>
          {preview.unmatched.length > 0 && (
            <div className="rounded-xl bg-[#EEF1F5] p-3">
              <h3 className="font-bold">{L.unmatched}</h3>
              <p className="text-sm text-muted">{kind === "payments" ? L.unmatchedHelp : ""}</p>
              <ul className="mt-1 text-sm">{preview.unmatched.map((u, i) => <li key={i}>{t.import.row} {u.row} · {u.unit}</li>)}</ul>
            </div>
          )}
          {preview.problems.length > 0 && (
            <div className="rounded-xl bg-[#FDF0DC] p-3 text-[#7A4A00]">
              <h3 className="font-bold">{t.import.problems}</h3>
              <ul className="mt-1 text-sm">{preview.problems.map((p, i) => <li key={i}>{t.import.row} {p.row} · {p.column} · {p.reason}</li>)}</ul>
            </div>
          )}
          <button disabled={pending || preview.added + preview.changed === 0} onClick={apply} className="h-14 rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">{t.import.confirm}</button>
        </section>
      )}
      {aptPreview && (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-[17px] font-bold">{t.import.preview}</h2>
          <p className="text-[15px]">{L.aptCounts(aptPreview.unitsAdded, aptPreview.unitsChanged, aptPreview.peopleAdded, aptPreview.peopleChanged)}</p>
          {aptPreview.problems.length > 0 && (
            <div className="rounded-xl bg-[#FDF0DC] p-3 text-[#7A4A00]">
              <h3 className="font-bold">{t.import.problems}</h3>
              <ul className="mt-1 text-sm">{aptPreview.problems.map((p, i) => <li key={i}>{t.import.row} {p.row} · {p.column} · {p.reason}</li>)}</ul>
            </div>
          )}
          <button disabled={pending || aptPreview.unitsAdded + aptPreview.unitsChanged + aptPreview.peopleAdded + aptPreview.peopleChanged + aptPreview.fees === 0} onClick={apply} className="h-14 rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">{t.import.confirm}</button>
        </section>
      )}
      {done && <p role="status" className="card p-4 font-semibold text-[#1F7A47]">{t.import.done}</p>}
    </div>
  );
}
