-- Unify installation statuses: EN_PARC_GARANTIE and EN_PARC_HORS_GARANTIE → EN_PARC
-- Status changes are now manual only.
UPDATE "installations" SET "status" = 'EN_PARC' WHERE "status" IN ('EN_PARC_GARANTIE', 'EN_PARC_HORS_GARANTIE');

-- Update schema default
ALTER TABLE "installations" ALTER COLUMN "status" SET DEFAULT 'EN_PARC';
