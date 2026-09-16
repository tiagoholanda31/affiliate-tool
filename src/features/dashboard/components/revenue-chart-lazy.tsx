"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { RevenueCommissionsDay } from "@/features/dashboard/queries";

const RevenueChart = dynamic(
  () =>
    import("@/features/dashboard/components/revenue-chart").then((mod) => mod.RevenueChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full" />,
  },
);

/** Wrapper client: `ssr: false` só é permitido fora de Server Components. */
export function RevenueChartLazy({ data }: { data: RevenueCommissionsDay[] }) {
  return <RevenueChart data={data} />;
}
