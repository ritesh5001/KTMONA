"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

interface RefundProduct {
  title: string;
  returnCount: number;
  refundAmount: number;
}

interface RefundBarChartProps {
  data: RefundProduct[];
}

export default function RefundBarChart({ data }: RefundBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border-soft"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="title"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          width={120}
          tickFormatter={(v: string) =>
            v.length > 18 ? v.slice(0, 18) + "\u2026" : v
          }
        />
        <Tooltip
          content={({
            active,
            payload,
          }: Record<string, unknown>) => {
            if (
              !active ||
              !Array.isArray(payload) ||
              payload.length === 0
            )
              return null;
            const d = (
              payload as Array<{ payload: Record<string, unknown> }>
            )[0].payload;
            return (
              <div className="rounded-md border border-border-soft bg-card px-3 py-2 shadow-lg text-xs space-y-1">
                <p className="font-medium text-foreground">
                  {String(d.title)}
                </p>
                <p className="text-muted-foreground">
                  Returns: {String(d.returnCount)} &middot; Impact:{" "}
                  {currency.format(Number(d.refundAmount))}
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="returnCount"
          fill="var(--color-brand, #FF8A00)"
          radius={[0, 4, 4, 0]}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
