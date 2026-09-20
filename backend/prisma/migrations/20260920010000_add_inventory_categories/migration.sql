-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "inventory_items_categoryId_idx" ON "inventory_items"("categoryId");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
