"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Home "Business Insights": views (or orders) per day/week/month. */
export default function InsightsChart({
  data,
  metric,
}: {
  data: { start: string; views: number; orders: number }[];
  metric: "views" | "orders";
}) {
  const points = data.map((d) => ({
    ...d,
    label: new Date(d.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
          formatter={(value) => [String(value), metric === "views" ? "Views" : "Orders"]}
        />
        <Line
          type="linear"
          dataKey={metric}
          stroke="var(--color-brand)"
          strokeWidth={2}
          dot={{ r: 3.5, fill: "var(--card)", stroke: "var(--color-brand)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
