"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendWeek } from "@/lib/domain/dashboard";

const BRAND = "#2D67C4";
const BRAND_LIGHT = "#A9C3EA";
const GRID = "#E4E8EF";
const MUTED = "#5B6478";
const tick = { fill: MUTED, fontSize: 12 };
const tooltipStyle = { borderRadius: 10, border: `1px solid ${GRID}`, boxShadow: "0 4px 12px rgba(16,24,40,.08)", fontSize: 13, direction: "rtl" as const };

/** Faults opened and closed per week. Time runs right to left, as Hebrew reads. */
export function TrendChart({ data }: { data: TrendWeek[] }) {
  return (
    <div>
    <div className="flex gap-4 pb-2 text-[13px] text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND }} />נפתחו</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND_LIGHT }} />נסגרו</span>
    </div>
    <div className="h-[220px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={3}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" reversed tick={tick} axisLine={false} tickLine={false} />
          <YAxis orientation="right" allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip cursor={{ fill: "#F4F6FA" }} contentStyle={tooltipStyle} labelFormatter={(l) => `שבוע מ-${l}`} />
          <Bar dataKey="opened" name="נפתחו" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="closed" name="נסגרו" fill={BRAND_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}

/** Open faults per building, as horizontal bars with the building name on the right. */
export function BuildingChart({ data }: { data: { building: string; count: number }[] }) {
  const height = Math.max(120, data.length * 40 + 16);
  return (
    <div className="w-full" style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <XAxis type="number" reversed hide allowDecimals={false} domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="building" orientation="right" width={120} tick={{ ...tick, fill: "#172033", fontSize: 13 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#F4F6FA" }} contentStyle={tooltipStyle} formatter={(v) => [v, "תקלות פתוחות"]} />
          <Bar dataKey="count" fill={BRAND} radius={[4, 0, 0, 4]} barSize={20} label={{ position: "insideLeft", fill: "#FFFFFF", fontSize: 12, fontWeight: 600 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
