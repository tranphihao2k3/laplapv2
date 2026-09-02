-- Migration: Add contact settings (contact_channels, opening_hours, social_links)
-- Target: public.settings table

-- Insert contact_channels default value (JSON array)
INSERT INTO settings (group_name, key, value, description, created_at, updated_at)
VALUES (
  'contact',
  'contact_channels',
  '[{"icon":"phone","label":"Hotline bán hàng","value":"1900 1234","type":"phone"},{"icon":"headphones","label":"Hỗ trợ kỹ thuật","value":"1900 1234","type":"phone"},{"icon":"message-circle","label":"Zalo / WhatsApp","value":"0901 234 567","link":"https://zalo.me/0901234567","type":"zalo"},{"icon":"mail","label":"Email","value":"info@laplap.vn","type":"email"}]',
  'JSON array of contact channels: [{icon, label, value, link?, type}]',
  NOW(),
  NOW()
) ON CONFLICT (group_name, key) DO NOTHING;

-- Insert opening_hours default value (JSON object)
INSERT INTO settings (group_name, key, value, description, created_at, updated_at)
VALUES (
  'contact',
  'opening_hours',
  '{"weekday":"8:00 - 21:00","saturday":"8:00 - 22:00","sunday":"9:00 - 20:00"}',
  'JSON object with weekday/saturday/sunday/holidays hours',
  NOW(),
  NOW()
) ON CONFLICT (group_name, key) DO NOTHING;

-- Insert social_links default value (JSON object)
INSERT INTO settings (group_name, key, value, description, created_at, updated_at)
VALUES (
  'contact',
  'social_links',
  '{"facebook":"https://facebook.com/laplapcantho","zalo":"https://zalo.me/laplapcantho","website":"https://laplap.vn"}',
  'JSON object with facebook, zalo, website, tiktok, youtube, instagram URLs',
  NOW(),
  NOW()
) ON CONFLICT (group_name, key) DO NOTHING;
