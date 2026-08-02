-- Contract start date for DLP / AMC / CMC
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_start_date DATE DEFAULT NULL;
