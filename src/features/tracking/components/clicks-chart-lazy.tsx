"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { ClicksByDay } from "@/features/tracking/queries";

const ClicksChart = dynamic(
  () =>
    import("@/features/tracking/components/clicks-chart").then((mod) => mod.ClicksChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);

/** Wrapper client: `ssr: false` só é permitido fora de Server Components. */
export function ClicksChartLazy({ data }: { data: ClicksByDay[] }) {
  return <ClicksChart data={data} />;
}
