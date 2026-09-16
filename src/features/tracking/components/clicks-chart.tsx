"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ClicksByDay } from "@/features/tracking/queries";
import { formatDate } from "@/lib/dates";

export type ClicksChartProps = {
  data: ClicksByDay[];
};

type ChartRow = ClicksByDay & { label: string };

/** Gráfico de cliques por dia — client + lazy no painel (fora do bundle público). */
export function ClicksChart({ data }: ClicksChartProps) {
  const chartData: ChartRow[] = data.map((row) => ({
    ...row,
    label: formatShortDay(row.date),
  }));

  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico de cliques nos últimos 30 dias">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ebe9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#5c6b66" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#5c6b66" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(47, 127, 122, 0.08)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #d5ddd9",
              fontSize: 13,
            }}
            labelFormatter={(_label, payload) => {
              const row = payload[0]?.payload as ChartRow | undefined;
              if (!row?.date) return "";
              return formatDate(new Date(`${row.date}T12:00:00Z`));
            }}
            formatter={(value, name) => [
              String(value ?? 0),
              name === "unique" ? "Únicos" : "Total",
            ]}
          />
          <Bar dataKey="total" name="total" fill="#2f7f7a" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="unique" name="unique" fill="#e9be60" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShortDay(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  if (!month || !day) return isoDate;
  return `${day}/${month}`;
}
