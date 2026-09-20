-- CreateTable
CREATE TABLE "inventory_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_shelves" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_rooms_name_key" ON "inventory_rooms"("name");
CREATE INDEX "inventory_shelves_roomId_idx" ON "inventory_shelves"("roomId");
CREATE UNIQUE INDEX "inventory_shelves_roomId_name_key" ON "inventory_shelves"("roomId", "name");

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN "shelfId" TEXT, ADD COLUMN "roomId" TEXT;
ALTER TABLE "item_loans"
    ADD COLUMN "fromShelfId" TEXT,
    ADD COLUMN "fromRoomId" TEXT,
    ADD COLUMN "returnShelfId" TEXT,
    ADD COLUMN "returnRoomId" TEXT;

-- CreateIndex
CREATE INDEX "inventory_items_shelfId_idx" ON "inventory_items"("shelfId");
CREATE INDEX "inventory_items_roomId_idx" ON "inventory_items"("roomId");

-- AddForeignKey
ALTER TABLE "inventory_shelves" ADD CONSTRAINT "inventory_shelves_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "inventory_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "inventory_shelves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "inventory_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Blank room/shelf text on bins means "none".
UPDATE "inventory_bins" SET "room" = NULL WHERE "room" IS NOT NULL AND btrim("room") = '';
UPDATE "inventory_bins" SET "shelf" = NULL WHERE "shelf" IS NOT NULL AND btrim("shelf") = '';

-- Backfill the registry from the room and shelf names already typed onto bins.
INSERT INTO "inventory_rooms" ("id", "name", "updatedAt")
SELECT gen_random_uuid()::text, r.room, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT ON (lower(btrim("room"))) btrim("room") AS room FROM "inventory_bins" WHERE btrim(coalesce("room", '')) <> '' ORDER BY lower(btrim("room")), btrim("room")) r;

INSERT INTO "inventory_shelves" ("id", "name", "roomId", "updatedAt")
SELECT gen_random_uuid()::text, s.shelf, rm."id", CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (lower(btrim(coalesce("room", ''))), lower(btrim("shelf")))
        btrim("shelf") AS shelf, btrim(coalesce("room", '')) AS room
    FROM "inventory_bins"
    WHERE btrim(coalesce("shelf", '')) <> ''
    ORDER BY lower(btrim(coalesce("room", ''))), lower(btrim("shelf")), btrim("shelf")
) s
LEFT JOIN "inventory_rooms" rm ON lower(rm."name") = lower(s.room);

-- Make the bins' text agree with the registry's spelling (case/whitespace).
UPDATE "inventory_bins" b SET "room" = rm."name"
FROM "inventory_rooms" rm
WHERE b."room" IS NOT NULL AND lower(btrim(b."room")) = lower(rm."name") AND b."room" <> rm."name"
  -- Leave a bin alone if renaming its room would collide with a same-named bin ((room, name) is unique).
  AND NOT EXISTS (SELECT 1 FROM "inventory_bins" o WHERE o."id" <> b."id" AND o."room" = rm."name" AND o."name" = b."name");
UPDATE "inventory_bins" b SET "shelf" = sh."name"
FROM "inventory_shelves" sh
LEFT JOIN "inventory_rooms" rm ON rm."id" = sh."roomId"
WHERE b."shelf" IS NOT NULL AND lower(btrim(b."shelf")) = lower(sh."name")
  AND lower(btrim(coalesce(b."room", ''))) = lower(coalesce(rm."name", ''))
  AND b."shelf" <> sh."name";
