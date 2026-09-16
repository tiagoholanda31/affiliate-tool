/**
 * Seed do banco.
 *
 * Fatia 00: a linha única de `Setting`.
 * Fatia 01: o admin (`ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) e um afiliado em
 * cada status que tem tela, para dar para ver `/painel/aguardando`,
 * `/painel/reprovado` e `/painel/suspenso` sem mexer no banco à mão.
 *
 * O seed **não** importa `src/lib/auth.ts`: aquele módulo carrega o plugin
 * `nextCookies`, que depende de `next/headers` e não existe fora de uma
 * requisição. A senha é gerada com `hashPassword` do próprio Better Auth, então
 * o hash é exatamente o que o login espera.
 *
 * Só roda fora de produção; em produção exige `SEED_FORCE=1` (ver docs/spec/03).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { createCipheriv, randomBytes } from "node:crypto";

import { PrismaClient } from "../src/generated/prisma/client.js";
import type { AffiliateStatus, PixKeyType, SocialNetwork } from "../src/generated/prisma/enums.js";

const TERMS_PLACEHOLDER = `# Termos do Programa de Afiliados

> Texto provisório. A versão oficial será fornecida pelo Affiliate Tool
> (pendência externa registrada em docs/PROGRESS.md) e substituída via
> /admin/configuracoes sem necessidade de deploy.

Ao participar do programa, você concorda em divulgar os serviços e materiais do
Affiliate Tool de forma honesta, sem prometer resultados que o produto não oferece e sem usar
a marca de maneira que sugira vínculo empregatício ou responsabilidade técnica.
`;

/** Provedor de senha local do Better Auth (ver `createLocalAccountIssuer`). */
const CREDENTIAL_PROVIDER = "credential";

/**
 * Mesma cifra de `src/lib/crypto.ts`, reimplementada aqui porque aquele módulo
 * lê a chave por `src/lib/env.ts`, que só valida dentro do Next. Se o formato
 * mudar lá, muda aqui — os dois estão amarrados pelo prefixo `v1`.
 */
function encrypt(plainText: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** `123.456.789-09` → `***.456.789-**`, igual a `maskPixKey` de src/lib/crypto.ts. */
function maskCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

type SeedAffiliate = {
  name: string;
  email: string;
  status: AffiliateStatus;
  statusReason: string | null;
  code: string | null;
  reviewCount: number;
  socialNetwork: SocialNetwork;
  socialHandle: string;
  phone: string;
  pixKeyType: PixKeyType;
  /** CPFs de teste com dígitos verificadores válidos. */
  pixKey: string;
};

const SEED_AFFILIATES: SeedAffiliate[] = [
  {
    name: "Ana Ribeiro",
    email: "afiliado.pendente@exemplo.test",
    status: "PENDING",
    statusReason: null,
    code: null,
    reviewCount: 0,
    socialNetwork: "INSTAGRAM",
    socialHandle: "ana.ribeiro",
    phone: "+5511988887777",
    pixKeyType: "CPF",
    pixKey: "52998224725",
  },
  {
    name: "Bruno Tavares",
    email: "afiliado.aprovado@exemplo.test",
    status: "APPROVED",
    statusReason: null,
    code: "brnt4vs",
    reviewCount: 0,
    socialNetwork: "YOUTUBE",
    socialHandle: "brunotavares",
    phone: "+5511977776666",
    pixKeyType: "CPF",
    pixKey: "15350946056",
  },
  {
    name: "Carla Menezes",
    email: "afiliado.reprovado@exemplo.test",
    status: "REJECTED",
    statusReason:
      "O perfil informado não estava público, então não conseguimos conferir o conteúdo. Deixe o perfil aberto e reenvie.",
    code: null,
    reviewCount: 0,
    socialNetwork: "TIKTOK",
    socialHandle: "carla.menezes",
    phone: "+5511966665555",
    pixKeyType: "CPF",
    pixKey: "11144477735",
  },
  {
    name: "Diego Prado",
    email: "afiliado.suspenso@exemplo.test",
    status: "SUSPENDED",
    statusReason:
      "Suspensão preventiva: identificamos cliques repetidos do mesmo endereço. Estamos apurando.",
    code: "dgprado",
    reviewCount: 0,
    socialNetwork: "FACEBOOK",
    socialHandle: "diego.prado",
    phone: "+5511955554444",
    pixKeyType: "CPF",
    pixKey: "12345678909",
  },
];

/** Senha única dos afiliados de teste — longa o bastante para o mínimo de 10. */
const SEED_AFFILIATE_PASSWORD = "afiliado-teste-2026";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida — copie .env.example para .env.");
  }

  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error(
      "Seed bloqueado em produção. Rode com SEED_FORCE=1 se for realmente intencional.",
    );
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY não definida — necessária para gravar a chave Pix cifrada.");
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD não definida — veja .env.example.");
  }
  // docs/spec/04: a conta mais valiosa do sistema não nasce com senha curta.
  if (adminPassword.length < 14) {
    throw new Error("SEED_ADMIN_PASSWORD precisa de pelo menos 14 caracteres.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const issuer = createLocalAccountIssuer(CREDENTIAL_PROVIDER);

  /** Cria (ou reaproveita) usuário + conta de senha. */
  async function upsertUser(input: {
    email: string;
    name: string;
    role: "ADMIN" | "AFFILIATE";
    password: string;
  }): Promise<string> {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      // Não sobrescreve nome nem papel de quem já existe: o seed é idempotente,
      // mas não desfaz o que foi ajustado depois.
      update: {},
      create: {
        email: input.email,
        name: input.name,
        role: input.role,
        // Sem verificação pendente: o objetivo do seed é poder entrar.
        emailVerified: true,
      },
      select: { id: true },
    });

    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
      select: { id: true },
    });

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          issuer,
          accountId: user.id,
          providerId: CREDENTIAL_PROVIDER,
          password: await hashPassword(input.password),
        },
      });
    }

    return user.id;
  }

  try {
    const setting = await prisma.setting.upsert({
      where: { id: 1 },
      // Não sobrescreve valores já ajustados pelo admin em /admin/configuracoes.
      update: {},
      create: {
        id: 1,
        termsMarkdown: TERMS_PLACEHOLDER,
        adminNotifyEmail: adminEmail,
        supportWhatsapp: "+5511912345678",
      },
      select: { holdDays: true, payoutDay: true, termsVersion: true },
    });

    console.log(
      `Setting ok (carência ${String(setting.holdDays)} dias, pagamento dia ${String(setting.payoutDay)}).`,
    );

    await upsertUser({
      email: adminEmail,
      name: "Affiliate Tool Admin",
      role: "ADMIN",
      password: adminPassword,
    });
    console.log(`Admin ok (${adminEmail}).`);

    for (const seed of SEED_AFFILIATES) {
      const userId = await upsertUser({
        email: seed.email,
        name: seed.name,
        role: "AFFILIATE",
        password: SEED_AFFILIATE_PASSWORD,
      });

      await prisma.affiliate.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          code: seed.code,
          phone: seed.phone,
          socialNetwork: seed.socialNetwork,
          socialHandle: seed.socialHandle,
          pixKeyType: seed.pixKeyType,
          pixKeyEncrypted: encrypt(seed.pixKey, encryptionKey),
          pixKeyMasked: maskCpf(seed.pixKey),
          status: seed.status,
          statusReason: seed.statusReason,
          reviewCount: seed.reviewCount,
          termsVersion: setting.termsVersion,
          termsAcceptedAt: new Date(),
          termsIp: "127.0.0.1",
        },
      });
    }

    console.log(
      `Afiliados de teste ok (${SEED_AFFILIATES.map((a) => a.status).join(", ")}) — senha "${SEED_AFFILIATE_PASSWORD}".`,
    );

    // Produtos de exemplo (fatia 03) — sem arquivo digital real; DIGITAL fica DRAFT.
    const service = await prisma.product.upsert({
      where: { slug: "consulta-avaliacao" },
      update: {},
      create: {
        slug: "consulta-avaliacao",
        name: "Consulta de avaliação",
        type: "SERVICE",
        status: "ACTIVE",
        shortDescription:
          "Avaliação inicial com a equipe do Affiliate Tool para entender o melhor caminho de cuidado.",
        description: `## O que está incluso

- Conversa inicial de até 50 minutos
- Orientações personalizadas
- Encaminhamento para o próximo passo

Entraremos em contato pelo WhatsApp após a confirmação do pagamento.`,
        priceCents: 25000,
        compareAtPriceCents: 30000,
        commissionType: "PERCENT",
        commissionValue: 1500,
        allowPix: true,
        allowCard: true,
        maxInstallments: 3,
        deliveryNote: "Entraremos em contato em até 1 dia útil pelo WhatsApp.",
        sortOrder: 0,
      },
    });

    const digital = await prisma.product.upsert({
      where: { slug: "ebook-introducao" },
      update: {},
      create: {
        slug: "ebook-introducao",
        name: "E-book Introdução",
        type: "DIGITAL",
        status: "DRAFT",
        shortDescription:
          "Material digital introdutório. Publique após enviar o PDF em /admin/produtos.",
        description: `## Conteúdo

Material em PDF com conceitos essenciais. O arquivo é anexado pelo admin antes da publicação.`,
        priceCents: 4900,
        commissionType: "FIXED",
        commissionValue: 1000,
        allowPix: true,
        allowCard: true,
        maxInstallments: 1,
        sortOrder: 1,
      },
    });

    console.log(`Produtos de exemplo ok (${service.slug} ACTIVE, ${digital.slug} DRAFT).`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
