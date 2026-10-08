-- AlterEnum: Add CANCELLED to SettlementStatus
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
