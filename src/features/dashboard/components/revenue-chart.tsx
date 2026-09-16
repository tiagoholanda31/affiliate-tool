"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RevenueCommissionsDay } from "@/features/dashboard/queries";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type RevenueChartProps = {
  data: RevenueCommissionsDay[];
};

type ChartRow = RevenueCommissionsDay & { label: string };

/** Receita × comissões (90 dias) — client + lazy no admin. */
export function RevenueChart({ data }: RevenueChartProps) {
  const chartData: ChartRow[] = data.map((row) => ({
    ...row,
    label: formatShortDay(row.date),
  }));

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Gráfico de receita e comissões nos últimos 90 dias"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ebe9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#5c6b66" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={36}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#5c6b66" }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
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
              formatBRL(Number(value ?? 0)),
              name === "revenueCents" ? "Receita" : "Comissões",
            ]}
          />
          <Legend
            formatter={(value) => (value === "revenueCents" ? "Receita" : "Comissões")}
          />
          <Line
            type="monotone"
            dataKey="revenueCents"
            name="revenueCents"
            stroke="#2f7f7a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="commissionsCents"
            name="commissionsCents"
            stroke="#e9be60"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShortDay(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  if (!month || !day) return isoDate;
  return `${day}/${month}`;
}

/** Eixo Y compacto em reais (centavos → R$). */
function formatCompact(cents: number): string {
  const reais = cents / 100;
  if (reais >= 1000) return `${(reais / 1000).toFixed(1)}k`;
  return String(Math.round(reais));
}
