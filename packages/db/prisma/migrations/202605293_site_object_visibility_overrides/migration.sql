CREATE TABLE "SiteObjectVisibilityOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteObjectVisibilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteObjectVisibilityOverride_organizationId_propertyObjectId_key" ON "SiteObjectVisibilityOverride"("organizationId", "propertyObjectId");
CREATE INDEX "SiteObjectVisibilityOverride_organizationId_hidden_idx" ON "SiteObjectVisibilityOverride"("organizationId", "hidden");
CREATE INDEX "SiteObjectVisibilityOverride_propertyObjectId_idx" ON "SiteObjectVisibilityOverride"("propertyObjectId");

ALTER TABLE "SiteObjectVisibilityOverride"
ADD CONSTRAINT "SiteObjectVisibilityOverride_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteObjectVisibilityOverride"
ADD CONSTRAINT "SiteObjectVisibilityOverride_propertyObjectId_fkey"
FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
