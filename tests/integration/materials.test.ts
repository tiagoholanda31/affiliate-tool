/**
 * Materiais: CRUD admin com audit, download por role/status, limites de upload.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as downloadGet } from "@/app/api/materials/[id]/download/route";
import { POST as uploadPost } from "@/app/api/admin/uploads/[kind]/route";
import {
  createMaterialAction,
  setMaterialActiveAction,
} from "@/features/materials/actions";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import {
  createCookieStore,
  requestContext,
  seedSettings,
  signInAndGetCookie,
  truncateAll,
} from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  updateTag: () => undefined,
  revalidateTag: () => undefined,
}));

const PASSWORD = "materialVerdeNaPrateleira";

async function createAdmin(email: string) {
  await auth.api.signUpEmail({
    body: {
      name: "Admin Materiais",
      email,
      password: PASSWORD,
      callbackURL: "/verificar-email?status=ok",
    },
    headers: requestContext.headers,
  });
  await db.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  return { email, password: PASSWORD };
}

async function createAffiliateWithLogin(
  email: string,
  status: "APPROVED" | "PENDING" | "SUSPENDED",
  code: string,
) {
  await auth.api.signUpEmail({
    body: {
      name: "Afiliado Materiais",
      email,
      password: PASSWORD,
      callbackURL: "/verificar-email?status=ok",
    },
    headers: requestContext.headers,
  });
  const user = await db.user.update({
    where: { email },
    data: { emailVerified: true, role: "AFFILIATE" },
  });
  const affiliate = await db.affiliate.create({
    data: {
      userId: user.id,
      code,
      status,
      phone: "+5511999990002",
      socialNetwork: "INSTAGRAM",
      socialHandle: "mat",
      pixKeyType: "EMAIL",
      pixKeyEncrypted: encrypt(email),
      pixKeyMasked: "m***@teste.local",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsIp: "127.0.0.1",
    },
  });
  return { email, password: PASSWORD, affiliate };
}

function applyCookie(cookie: string) {
  requestContext.setCookie(cookie);
  cookieStore.jar.clear();
  for (const part of cookie.split("; ")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    cookieStore.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v1");
  requestContext.reset();
  cookieStore.jar.clear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("materials", () => {
  it("admin cria TEXT, registra audit e inativa", async () => {
    const admin = await createAdmin("admin.materiais@teste.local");
    applyCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const created = await createMaterialAction({
      title: "Copy Instagram",
      type: "TEXT",
      isActive: true,
      sortOrder: 0,
      textContent: "Compre pelo meu link: {{link}}",
      description: null,
      productId: null,
      externalUrl: null,
      file: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const audits = await db.auditLog.findMany({ where: { entityId: created.data.id } });
    expect(audits.some((a) => a.action === "material.create")).toBe(true);

    const inactive = await setMaterialActiveAction({ id: created.data.id, isActive: false });
    expect(inactive.ok).toBe(true);

    const row = await db.material.findUnique({ where: { id: created.data.id } });
    expect(row?.isActive).toBe(false);
  });

  it("download: APPROVED ok, PENDING 403, inativo 404 para afiliado", async () => {
    const relative = `materials/dl-test-${String(Date.now())}.pdf`;
    const absolute = path.resolve(env.STORAGE_DIR, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from("%PDF-1.4 materials\n%%EOF\n"));

    const material = await db.material.create({
      data: {
        title: "Folder PDF",
        type: "PDF",
        isActive: true,
        filePath: relative,
        fileName: "folder.pdf",
        mimeType: "application/pdf",
        sizeBytes: 32,
      },
    });

    const approved = await createAffiliateWithLogin("aff.ok@teste.local", "APPROVED", "affok01");
    applyCookie(await signInAndGetCookie(auth, approved.email, approved.password));

    const okRes = await downloadGet(new Request("http://localhost/api/materials/x/download"), {
      params: Promise.resolve({ id: material.id }),
    });
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("Content-Disposition")).toMatch(/folder\.pdf/);

    const pending = await createAffiliateWithLogin("aff.pending@teste.local", "PENDING", "affpe01");
    applyCookie(await signInAndGetCookie(auth, pending.email, pending.password));

    const forbidden = await downloadGet(new Request("http://localhost/api/materials/x/download"), {
      params: Promise.resolve({ id: material.id }),
    });
    expect(forbidden.status).toBe(403);

    await db.material.update({ where: { id: material.id }, data: { isActive: false } });
    applyCookie(await signInAndGetCookie(auth, approved.email, approved.password));

    const hidden = await downloadGet(new Request("http://localhost/api/materials/x/download"), {
      params: Promise.resolve({ id: material.id }),
    });
    expect(hidden.status).toBe(404);
  });

  it("upload material: PDF 25 MB rejeitado; imagem pequena gera thumb", async () => {
    const admin = await createAdmin("admin.upload.mat@teste.local");
    const cookie = await signInAndGetCookie(auth, admin.email, admin.password);
    applyCookie(cookie);

    const huge = new File([new Uint8Array(25 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    const hugeForm = new FormData();
    hugeForm.append("file", huge);
    const hugeRes = await uploadPost(
      new NextRequest(
        new Request("http://localhost/api/admin/uploads/material", {
          method: "POST",
          body: hugeForm,
          headers: { cookie },
        }),
      ),
      { params: Promise.resolve({ kind: "material" }) },
    );
    expect(hugeRes.status).toBe(413);

    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({
      create: { width: 32, height: 24, channels: 3, background: { r: 20, g: 80, b: 120 } },
    })
      .jpeg()
      .toBuffer();
    const imgForm = new FormData();
    imgForm.append("file", new File([jpeg], "dot.jpg", { type: "image/jpeg" }));
    const imgRes = await uploadPost(
      new NextRequest(
        new Request("http://localhost/api/admin/uploads/material", {
          method: "POST",
          body: imgForm,
          headers: { cookie },
        }),
      ),
      { params: Promise.resolve({ kind: "material" }) },
    );
    expect(imgRes.status).toBe(200);
    const json = (await imgRes.json()) as {
      ok: boolean;
      data?: { thumbPath?: string; mime: string };
    };
    expect(json.ok).toBe(true);
    expect(json.data?.thumbPath).toBeTruthy();
    expect(json.data?.mime).toBe("image/jpeg");
  });
});
