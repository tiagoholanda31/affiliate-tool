-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "codeEditedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
