-- Add a dedicated RSVP code to events, mirroring checkInCode.
-- Kept separate from checkInCode so the RSVP QR can go on flyers ahead of the
-- event while the check-in QR stays at the door, and so either code can later
-- be rotated without invalidating the other.
ALTER TABLE "events" ADD COLUMN "rsvpCode" TEXT;

-- Backfill existing events with a unique 8-character uppercase hex code,
-- matching the format generated in eventManager.createEvent.
UPDATE "events"
SET "rsvpCode" = upper(substr(md5(random()::text || "id"), 1, 8));

ALTER TABLE "events" ALTER COLUMN "rsvpCode" SET NOT NULL;

CREATE UNIQUE INDEX "events_rsvpCode_key" ON "events"("rsvpCode");
