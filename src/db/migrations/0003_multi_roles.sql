-- Migrate single-role config keys to JSON arrays.
-- Uses INSERT ... SELECT so rows with no existing value produce no output row (safe no-op).

INSERT INTO guild_config (key, value)
SELECT 'staff_role_ids', json_array(value) FROM guild_config WHERE key = 'staff_role_id'
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

INSERT INTO guild_config (key, value)
SELECT 'mod_role_ids', json_array(value) FROM guild_config WHERE key = 'mod_role_id'
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

INSERT INTO guild_config (key, value)
SELECT 'on_leave_role_ids', json_array(value) FROM guild_config WHERE key = 'on_leave_role_id'
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

DELETE FROM guild_config WHERE key IN ('staff_role_id', 'mod_role_id', 'on_leave_role_id');
