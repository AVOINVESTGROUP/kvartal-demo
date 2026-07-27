-- PostgreSQL requires newly added enum values to be committed before they are
-- referenced by indexes or data mutations in a later transaction.
ALTER TYPE "PropertyRepresentationStatus" ADD VALUE IF NOT EXISTS 'ATTESTED';
ALTER TYPE "PropertyRepresentationStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "PropertyTokenOperationStatus" ADD VALUE IF NOT EXISTS 'PENDING_PLATFORM_SIGNER';
