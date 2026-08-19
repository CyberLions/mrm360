CREATE TABLE "inventory_bins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room" TEXT,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_bins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "binId" TEXT,
    "checkedOutToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_loans" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "returnBinId" TEXT,
    CONSTRAINT "item_loans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_bins_room_name_key" ON "inventory_bins"("room", "name");
CREATE UNIQUE INDEX "inventory_items_barcode_key" ON "inventory_items"("barcode");
CREATE INDEX "inventory_items_name_idx" ON "inventory_items"("name");
CREATE INDEX "inventory_items_binId_idx" ON "inventory_items"("binId");
CREATE INDEX "inventory_items_checkedOutToId_idx" ON "inventory_items"("checkedOutToId");
CREATE INDEX "item_loans_itemId_checkedInAt_idx" ON "item_loans"("itemId", "checkedInAt");
CREATE INDEX "item_loans_userId_checkedInAt_idx" ON "item_loans"("userId", "checkedInAt");
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_binId_fkey" FOREIGN KEY ("binId") REFERENCES "inventory_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_checkedOutToId_fkey" FOREIGN KEY ("checkedOutToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_loans" ADD CONSTRAINT "item_loans_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_loans" ADD CONSTRAINT "item_loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
