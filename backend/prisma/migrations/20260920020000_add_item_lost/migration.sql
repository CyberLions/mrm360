-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN "lostAt" TIMESTAMP(3),
ADD COLUMN "lostNote" TEXT;
