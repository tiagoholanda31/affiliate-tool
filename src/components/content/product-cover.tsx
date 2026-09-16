import Image from "next/image";

import { cn } from "@/lib/utils";

type ProductCoverProps = {
  productId: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
};

/** Capa via Route Handler — `unoptimized` porque a origem é API, não `public/`. */
export function ProductCover({
  productId,
  alt,
  size = "md",
  className,
  priority,
}: ProductCoverProps) {
  const dimensions = size === "sm" ? 400 : size === "lg" ? 1200 : 800;
  const height = size === "sm" ? 300 : size === "lg" ? 900 : 600;

  return (
    <Image
      src={`/api/media/cover/${productId}?size=${size}`}
      alt={alt}
      width={dimensions}
      height={height}
      unoptimized
      priority={priority}
      className={cn("aspect-[4/3] w-full object-cover", className)}
    />
  );
}
