-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT,
    "ipHash" TEXT NOT NULL,
    "uaHash" TEXT NOT NULL,
    "referer" TEXT,
    "isUnique" BOOLEAN NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Click_affiliateId_createdAt_idx" ON "Click"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "Click_affiliateId_ipHash_createdAt_idx" ON "Click"("affiliateId", "ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
