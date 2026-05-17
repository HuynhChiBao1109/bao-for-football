-- Database schema ownership
-- This project uses GORM migration models and bootstrap flow as the single source of truth.
--
-- Source of schema + migration logic:
--   apps/service-core/internal/platform/mysql/bootstrap.go
--
-- To sync schema in development:
-- 1) Ensure MySQL database exists (example: fifam_dev)
-- 2) Run service-core; AutoMigrate + bootstrap seed logic will handle table updates/data seed.
--
-- Optional one-time DB bootstrap:
CREATE DATABASE IF NOT EXISTS fifam_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
