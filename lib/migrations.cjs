'use strict';
// Additive and retry-safe. Applied on first use after deployment, without a CLI step.
const upgradeSql=`
ALTER TABLE dayamora.products ADD COLUMN IF NOT EXISTS options TEXT NOT NULL DEFAULT '{}';
ALTER TABLE dayamora.orders ADD COLUMN IF NOT EXISTS payment TEXT NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS dayamora.shop_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dayamora.receipt_files(path TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES dayamora.orders(id),user_id TEXT NOT NULL REFERENCES dayamora.users(id));
INSERT INTO dayamora.migrations(version,applied_at) VALUES(2,(extract(epoch FROM now())*1000)::bigint) ON CONFLICT DO NOTHING;
`;
module.exports={upgradeSql};
