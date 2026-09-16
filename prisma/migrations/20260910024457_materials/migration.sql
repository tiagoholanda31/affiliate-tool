-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('IMAGE', 'PDF', 'TEXT', 'LINK');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MaterialType" NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "thumbPath" TEXT,
    "textContent" TEXT,
    "externalUrl" TEXT,
    "productId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_isActive_sortOrder_idx" ON "Material"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Material_productId_isActive_idx" ON "Material"("productId", "isActive");

-- CreateIndex
CREATE INDEX "Material_type_isActive_idx" ON "Material"("type", "isActive");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
