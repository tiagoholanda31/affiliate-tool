/**
 * Integração da rota `/r/[code]/[[...slug]]` e persistência de cliques.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as redirectGet } from "@/app/r/[code]/[[...slug]]/route";
import { REF_COOKIE_NAME, readRef } from "@/lib/attribution";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { recordClick, shouldTrackAffiliate } from "@/features/tracking/service";
import { clearAffiliateCodeCache } from "@/features/tracking/queries";
import { seedSettings, truncateAll } from "../helpers/integration";

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";

async function seedAffiliate(status: "APPROVED" | "SUSPENDED" | "REMOVED", code: string) {
  const user = await db.user.create({
    data: {
      name: `Afiliado ${code}`,
      email: `${code}@exemplo.test`,
      emailVerified: true,
      role: "AFFILIATE",
    },
  });

  return db.affiliate.create({
    data: {
      userId: user.id,
      code,
      status,
      phone: "+5511999990000",
      socialNetwork: "INSTAGRAM",
      socialHandle: code,
      pixKeyType: "EMAIL",
      pixKeyEncrypted: encrypt(`${code}@pix.test`),
      pixKeyMasked: "co***@pix.test",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsIp: "127.0.0.1",
    },
  });
}

async function seedProduct(slug: string) {
  return db.product.create({
    data: {
      slug,
      name: `Produto ${slug}`,
      type: "DIGITAL",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: 9900,
      commissionType: "PERCENT",
      commissionValue: 1500,
    },
  });
}

function makeRequest(path: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", UA_BROWSER);
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", "203.0.113.50");
  return new Request(`http://localhost:3000${path}`, { ...init, headers });
}

describe("rota /r — tracking", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    clearAffiliateCodeCache();
    await truncateAll();
    await seedSettings();
  });

  afterAll(async () => {
    await truncateAll();
    await db.$disconnect();
  });

  it("APPROVED grava clique, seta cookie e redireciona ao produto", async () => {
    const affiliate = await seedAffiliate("APPROVED", "bruno");
    const product = await seedProduct("livro-teste");

    const response = await redirectGet(makeRequest("/r/bruno/livro-teste"), {
      params: Promise.resolve({ code: "bruno", slug: ["livro-teste"] }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/p/livro-teste");

    const setCookie =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    const refCookie = setCookie.find((c) => c.startsWith(`${REF_COOKIE_NAME}=`));
    expect(refCookie).toBeTruthy();
    expect(refCookie).toMatch(/HttpOnly/i);
    expect(refCookie).toMatch(/SameSite=Lax/i);

    const token = refCookie?.split(";")[0]?.split("=").slice(1).join("=") ?? "";
    const payload = await readRef(token);
    expect(payload?.a).toBe(affiliate.id);

    // Espera o insert em background
    await new Promise((r) => setTimeout(r, 100));
    const clicks = await db.click.findMany({ where: { affiliateId: affiliate.id } });
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.productId).toBe(product.id);
    expect(clicks[0]?.isBot).toBe(false);
    expect(clicks[0]?.isUnique).toBe(true);
  });

  it("SUSPENDED redireciona sem cookie e sem clique", async () => {
    await seedAffiliate("SUSPENDED", "susp");
    await seedProduct("livro-susp");

    const response = await redirectGet(makeRequest("/r/susp/livro-susp"), {
      params: Promise.resolve({ code: "susp", slug: ["livro-susp"] }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/p/livro-susp");
    const setCookie =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    expect(setCookie.some((c) => c.startsWith(`${REF_COOKIE_NAME}=`))).toBe(false);

    await new Promise((r) => setTimeout(r, 50));
    expect(await db.click.count()).toBe(0);
  });

  it("código inexistente redireciona à vitrine", async () => {
    const response = await redirectGet(makeRequest("/r/naotem"), {
      params: Promise.resolve({ code: "naotem" }),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/\/$/);
    expect(await db.click.count()).toBe(0);
  });

  it("segundo acesso do mesmo IP em 24h não é único", async () => {
    const affiliate = await seedAffiliate("APPROVED", "uniq");

    const first = await recordClick({
      affiliateId: affiliate.id,
      ip: "198.51.100.1",
      userAgent: UA_BROWSER,
      referer: null,
    });
    expect(first.isUnique).toBe(true);

    const second = await recordClick({
      affiliateId: affiliate.id,
      ip: "198.51.100.1",
      userAgent: UA_BROWSER,
      referer: null,
    });
    expect(second.isUnique).toBe(false);

    const total = await db.click.count({ where: { affiliateId: affiliate.id } });
    expect(total).toBe(2);
  });

  it("UA de bot grava isBot e shouldTrack só APPROVED", async () => {
    const affiliate = await seedAffiliate("APPROVED", "botty");
    const result = await recordClick({
      affiliateId: affiliate.id,
      ip: "198.51.100.9",
      userAgent: "Googlebot/2.1",
      referer: null,
    });
    expect(result.isBot).toBe(true);
    expect(shouldTrackAffiliate("APPROVED")).toBe(true);
    expect(shouldTrackAffiliate("SUSPENDED")).toBe(false);
    expect(shouldTrackAffiliate("REMOVED")).toBe(false);
  });

  it("requisições concorrentes: total conta, único não duplica além da corrida", async () => {
    const affiliate = await seedAffiliate("APPROVED", "race");

    await Promise.all([
      recordClick({
        affiliateId: affiliate.id,
        ip: "198.51.100.77",
        userAgent: UA_BROWSER,
        referer: null,
      }),
      recordClick({
        affiliateId: affiliate.id,
        ip: "198.51.100.77",
        userAgent: UA_BROWSER,
        referer: null,
      }),
    ]);

    const clicks = await db.click.findMany({ where: { affiliateId: affiliate.id } });
    expect(clicks).toHaveLength(2);
    const uniqueCount = clicks.filter((c) => c.isUnique).length;
    // Em corrida perfeita ambos podem achar unique; tolerância da fatia: total=2.
    expect(uniqueCount).toBeGreaterThanOrEqual(1);
    expect(uniqueCount).toBeLessThanOrEqual(2);
  });
});
