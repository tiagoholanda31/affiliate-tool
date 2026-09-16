/**
 * Busca global ⌘K (admin): afiliados, produtos e pedidos.
 */
import type { Role } from "@/generated/prisma/enums";

import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";

const LIMIT = 8;

export type SearchHit = {
  id: string;
  label: string;
  secondary?: string;
  href: string;
};

export type GlobalSearchResult = {
  affiliates: SearchHit[];
  products: SearchHit[];
  orders: SearchHit[];
};

/** Remove `@` inicial para bater handle de rede social. */
export function normalizeSearchQuery(q: string): string {
  const trimmed = q.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
}

/**
 * Busca agrupada. Por enquanto só `ADMIN` (role checado aqui e via adminAction).
 */
export async function globalSearch(q: string, role: Role): Promise<GlobalSearchResult> {
  if (role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Busca global disponível apenas para administradores.");
  }

  const term = normalizeSearchQuery(q);
  if (!term) {
    return { affiliates: [], products: [], orders: [] };
  }

  const [affiliates, products, orders] = await Promise.all([
    db.affiliate.findMany({
      where: {
        OR: [
          { user: { name: { contains: term, mode: "insensitive" } } },
          { user: { email: { contains: term, mode: "insensitive" } } },
          { code: { contains: term, mode: "insensitive" } },
          { socialHandle: { contains: term, mode: "insensitive" } },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        socialHandle: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
        ],
      },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, slug: true },
    }),
    db.order.findMany({
      where: {
        OR: [
          { publicCode: { contains: term, mode: "insensitive" } },
          { customerEmail: { contains: term, mode: "insensitive" } },
        ],
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicCode: true,
        customerEmail: true,
        productNameSnap: true,
      },
    }),
  ]);

  return {
    affiliates: affiliates.map((a) => ({
      id: a.id,
      label: a.user.name,
      secondary: [a.code, a.user.email, a.socialHandle ? `@${a.socialHandle.replace(/^@/, "")}` : null]
        .filter(Boolean)
        .join(" · "),
      href: `/admin/afiliados/${a.id}`,
    })),
    products: products.map((p) => ({
      id: p.id,
      label: p.name,
      secondary: p.slug,
      href: `/admin/produtos/${p.id}`,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      label: o.publicCode,
      secondary: `${o.productNameSnap} · ${o.customerEmail}`,
      href: `/admin/vendas/${o.id}`,
    })),
  };
}
