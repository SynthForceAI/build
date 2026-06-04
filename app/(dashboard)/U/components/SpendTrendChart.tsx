"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type DailySpend = { date: string; cents: number };

function fmtDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function SpendTrendChart({ data }: { data: DailySpend[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `$${(v / 100).toFixed(2)}`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value) => [fmtDollars(Number(value ?? 0)), "Spend"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
          labelStyle={{ color: "#6b7280", marginBottom: 2 }}
        />
        <Line
          type="monotone"
          dataKey="cents"
          stroke="#00B2FF"
          strokeWidth={2}
          dot={{ r: 3, fill: "#00B2FF", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#00B2FF" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
