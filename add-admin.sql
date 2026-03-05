-- Add admin user (use after running neon-schema-fresh.sql)
-- Login: admin1 / admin123

INSERT INTO users (user_id, email, password, name, role, phone, is_active, created_at, updated_at)
VALUES ('admin1', 'admin@nextstep.com', '$2a$10$gU3I.1tEKXOTnSqLLwptbudr72nVNWcDoiT9lKH/7y4lZJc0e7pli', 'Admin User', 'Admin', '1234567890', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
