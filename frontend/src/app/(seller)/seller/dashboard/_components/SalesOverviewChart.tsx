"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export default function SalesOverviewChart({ data }: { data: { date: string; sales: number; orders: number }[] }) {
  const points = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ktmSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => compact.format(v)} />
        <Tooltip
          cursor={{ stroke: "var(--color-brand)", strokeOpacity: 0.3 }}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
          formatter={(value, name) => (name === "sales" ? [inr.format(Number(value)), "Sales"] : [String(value), "Orders"])}
        />
        <Area type="monotone" dataKey="sales" stroke="var(--color-brand)" strokeWidth={2.5} fill="url(#ktmSales)" dot={{ r: 3, fill: "var(--color-brand)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
