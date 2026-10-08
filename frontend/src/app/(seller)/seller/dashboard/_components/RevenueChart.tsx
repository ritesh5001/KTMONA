"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-soft bg-card px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-medium text-foreground">
        {currency.format(payload[0].value)}
      </p>
    </div>
  );
}

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number }>;
  interval: "daily" | "weekly" | "monthly";
}

export default function RevenueChart({ data, interval }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-brand, #FF8A00)"
              stopOpacity={0.4}
            />
            <stop
              offset="100%"
              stopColor="var(--color-brand, #FF8A00)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border-soft" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return interval === "monthly"
              ? d.toLocaleDateString("en-IN", {
                  month: "short",
                  year: "2-digit",
                })
              : d.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                });
          }}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) => compact.format(v)}
          width={50}
        />
        <Tooltip content={<RevenueTooltip />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-brand, #FF8A00)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-brand, #FF8A00)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
