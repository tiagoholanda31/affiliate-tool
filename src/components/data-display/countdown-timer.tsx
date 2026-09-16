"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type CountdownTimerProps = {
  expiresAt: string | Date;
  onExpire?: () => void;
  className?: string;
};

function remainingMs(expiresAt: Date, now: number): number {
  return Math.max(0, expiresAt.getTime() - now);
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const target = useMemo(
    () => (typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt),
    [expiresAt],
  );
  const [ms, setMs] = useState(() => remainingMs(target, Date.now()));

  useEffect(() => {
    const tick = () => {
      const next = remainingMs(target, Date.now());
      setMs(next);
      if (next <= 0) {
        onExpire?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [target, onExpire]);

  const expired = ms <= 0;

  return (
    <p
      className={cn(
        "font-mono text-lg tabular-nums",
        expired ? "text-[color:var(--color-danger)]" : "text-navy-900",
        className,
      )}
      aria-live="polite"
    >
      {expired ? "Expirado" : formatRemaining(ms)}
    </p>
  );
}
