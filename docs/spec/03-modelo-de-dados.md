# 03 · Modelo de Dados (Prisma)

Better Auth gera `User`, `Session`, `Account`, `Verification` (rode `npx @better-auth/cli generate` na fatia 01 e
ajuste para o abaixo). Campos monetários em centavos (`Int`), percentuais em basis points. Todas as tabelas têm `createdAt`/`updatedAt`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { ADMIN AFFILIATE }
enum AffiliateStatus { PENDING APPROVED REJECTED SUSPENDED REMOVED }
enum SocialNetwork { INSTAGRAM TIKTOK YOUTUBE FACEBOOK LINKEDIN WHATSAPP OTHER }
enum PixKeyType { CPF CNPJ EMAIL PHONE RANDOM }
enum ProductType { SERVICE DIGITAL }
enum ProductStatus { DRAFT ACTIVE ARCHIVED }
enum CommissionType { PERCENT FIXED }
enum OrderSource { CHECKOUT MANUAL }
enum OrderStatus { PENDING PAID FAILED EXPIRED CANCELED REFUNDED CHARGEDBACK }
enum PaymentMethod { PIX CREDIT_CARD MANUAL }
enum CommissionStatus { PENDING AVAILABLE PAID REVERSED }
enum PayoutStatus { DRAFT PAID }
enum MaterialType { IMAGE PDF TEXT LINK }
enum WebhookStatus { RECEIVED PROCESSED IGNORED FAILED }
enum EmailStatus { QUEUED SENT FAILED }

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String
  role          Role      @default(AFFILIATE)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  affiliate     Affiliate?
  auditLogs     AuditLog[] @relation("actor")
}
// Session, Account, Verification: conforme geração do Better Auth

model Affiliate {
  id                 String          @id @default(cuid())
  userId             String          @unique
  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  code               String?         @unique            // definido na aprovação
  phone              String                              // E.164
  socialNetwork      SocialNetwork
  socialHandle       String
  pixKeyType         PixKeyType
  pixKeyEncrypted    String                              // AES-256-GCM
  pixKeyMasked       String                              // para exibição
  status             AffiliateStatus @default(PENDING)
  statusReason       String?
  statusChangedAt    DateTime        @default(now())
  reviewedById       String?
  reviewCount        Int             @default(0)
  termsVersion       String
  termsAcceptedAt    DateTime
  termsIp            String
  gatewayRecipientId String?                             // reservado: split futuro
  anonymizedAt       DateTime?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  clicks             Click[]
  orders             Order[]
  commissions        Commission[]
  adjustments        CommissionAdjustment[]
  payouts            Payout[]
  @@index([status])
}

model Product {
  id                       String         @id @default(cuid())
  slug                     String         @unique
  name                     String
  type                     ProductType
  status                   ProductStatus  @default(DRAFT)
  shortDescription         String
  description              String                          // markdown
  priceCents               Int
  compareAtPriceCents      Int?
  commissionType           CommissionType
  commissionValue          Int                             // bp ou centavos
  coverImagePath           String?
  allowPix                 Boolean        @default(true)
  allowCard                Boolean        @default(true)
  maxInstallments          Int            @default(1)
  deliveryNote             String?
  sortOrder                Int            @default(0)
  createdAt                DateTime       @default(now())
  updatedAt                DateTime       @updatedAt
  digitalFile              DigitalFile?
  orders                   Order[]
  clicks                   Click[]
  materials                Material[]
  @@index([status, sortOrder])
}

model DigitalFile {
  id           String   @id @default(cuid())
  productId    String   @unique
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  storagePath  String
  originalName String
  mimeType     String
  sizeBytes    Int
  sha256       String
  createdAt    DateTime @default(now())
}

model Click {
  id          String    @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  productId   String?
  product     Product?  @relation(fields: [productId], references: [id])
  ipHash      String
  uaHash      String
  referer     String?
  isUnique    Boolean
  isBot       Boolean   @default(false)
  createdAt   DateTime  @default(now())
  orders      Order[]
  @@index([affiliateId, createdAt])
  @@index([affiliateId, ipHash, createdAt])
}

model Order {
  id                String        @id @default(cuid())
  publicCode        String        @unique                 // IF-XXXXXX
  accessTokenHash   String        @unique                 // para /pedido/<code>?t=
  source            OrderSource
  status            OrderStatus   @default(PENDING)
  productId         String
  product           Product       @relation(fields: [productId], references: [id])
  productNameSnap   String
  affiliateId       String?
  affiliate         Affiliate?    @relation(fields: [affiliateId], references: [id])
  clickId           String?
  click             Click?        @relation(fields: [clickId], references: [id])
  customerName      String
  customerEmail     String
  customerPhone     String?
  customerDocEnc    String?                               // CPF/CNPJ criptografado
  customerDocMasked String?
  amountCents       Int
  paymentMethod     PaymentMethod
  installments      Int           @default(1)
  gatewayOrderId    String?       @unique
  gatewayChargeId   String?
  pixQrCode         String?
  pixQrCodeUrl      String?
  pixExpiresAt      DateTime?
  cardBrand         String?
  cardLast4         String?
  failureReason     String?
  paidAt            DateTime?
  refundedAt        DateTime?
  notes             String?                               // venda manual
  createdById       String?                               // admin (manual)
  metadata          Json          @default("{}")
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  commission        Commission?
  downloadGrants    DownloadGrant[]
  @@index([status, createdAt])
  @@index([affiliateId, createdAt])
  @@index([customerEmail])
}

model Commission {
  id                 String           @id @default(cuid())
  orderId            String           @unique
  order              Order            @relation(fields: [orderId], references: [id])
  affiliateId        String
  affiliate          Affiliate        @relation(fields: [affiliateId], references: [id])
  amountCents        Int
  baseAmountCents    Int
  rateType           CommissionType
  rateValue          Int
  status             CommissionStatus @default(PENDING)
  availableAt        DateTime
  paidAt             DateTime?
  reversedAt         DateTime?
  reversalReason     String?
  payoutId           String?
  payout             Payout?          @relation(fields: [payoutId], references: [id])
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  @@index([affiliateId, status])
  @@index([status, availableAt])
}

model CommissionAdjustment {
  id          String    @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  amountCents Int                                          // negativo = débito
  reason      String
  orderId     String?
  payoutId    String?
  payout      Payout?   @relation(fields: [payoutId], references: [id])
  createdById String
  createdAt   DateTime  @default(now())
  @@index([affiliateId, payoutId])
}

model Payout {
  id             String       @id @default(cuid())
  affiliateId    String
  affiliate      Affiliate    @relation(fields: [affiliateId], references: [id])
  status         PayoutStatus @default(DRAFT)
  totalCents     Int
  referenceMonth String                                    // YYYY-MM
  paidAt         DateTime?
  proofReference String?
  proofPath      String?
  notes          String?
  createdById    String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  commissions    Commission[]
  adjustments    CommissionAdjustment[]
  @@index([affiliateId, status])
}

model DownloadGrant {
  id             String    @id @default(cuid())
  orderId        String
  order          Order     @relation(fields: [orderId], references: [id])
  tokenHash      String    @unique
  expiresAt      DateTime
  maxDownloads   Int
  downloadCount  Int       @default(0)
  lastDownloadAt DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())
}

model Material {
  id          String       @id @default(cuid())
  title       String
  description String?
  type        MaterialType
  filePath    String?
  fileName    String?
  mimeType    String?
  sizeBytes   Int?
  textContent String?
  externalUrl String?
  productId   String?
  product     Product?     @relation(fields: [productId], references: [id], onDelete: SetNull)
  isActive    Boolean      @default(true)
  sortOrder   Int          @default(0)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Setting {
  id                    Int      @id @default(1)           // linha única
  holdDays              Int      @default(7)
  payoutDay             Int      @default(10)
  attributionDays       Int      @default(30)
  pixExpirationMinutes  Int      @default(30)
  downloadGrantDays     Int      @default(7)
  downloadMaxCount      Int      @default(5)
  termsVersion          String   @default("v1")
  termsMarkdown         String
  adminNotifyEmail      String
  supportWhatsapp       String
  updatedAt             DateTime @updatedAt
}

model WebhookEvent {
  id          String        @id @default(cuid())
  provider    String                                       // "pagarme"
  eventId     String        @unique
  type        String
  payload     Json
  status      WebhookStatus @default(RECEIVED)
  error       String?
  receivedAt  DateTime      @default(now())
  processedAt DateTime?
  @@index([status, receivedAt])
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      User?    @relation("actor", fields: [actorId], references: [id])
  actorRole  String                                        // ADMIN | AFFILIATE | SYSTEM
  action     String                                        // affiliate.approve, product.archive, payout.pay, pix.reveal ...
  entity     String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
}

model EmailLog {
  id         String      @id @default(cuid())
  to         String
  template   String
  status     EmailStatus @default(QUEUED)
  providerId String?
  attempts   Int         @default(0)
  error      String?
  createdAt  DateTime    @default(now())
  sentAt     DateTime?
  @@index([status, createdAt])
}

model JobRun {
  id         String    @id @default(cuid())
  name       String
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  ok         Boolean?
  summary    Json?
  error      String?
  @@index([name, startedAt])
}
```

## Notas

- `Order.amountCents` é a base da comissão. Em venda manual, admin pode informar valor diferente do preço.
- `Commission` é 1:1 com `Order`. Estorno **não apaga**; muda status e preserva histórico.
- Nunca faça `SUM` no client: saldos vêm de `commissions/service.ts::getBalances(affiliateId, tx)` com `groupBy`.
- Migration inicial na fatia 00 contém apenas Better Auth + `Setting` + `AuditLog` + `JobRun`; demais tabelas entram na fatia que as usa (rastreabilidade).
- Seed: admin (`ADMIN_EMAIL` / senha em `SEED_ADMIN_PASSWORD`), `Setting` padrão, 3 produtos (1 serviço, 1 livro com PDF de exemplo, 1 rascunho), 2 afiliados (`PENDING`, `APPROVED`) — seed **só** roda com `NODE_ENV !== production` ou flag `SEED_FORCE=1`.
