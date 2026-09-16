import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto compartilhado pelos `loading.tsx` de cada segmento. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Carregando…
      </span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
