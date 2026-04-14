-- Fase 6: City Groups
-- UP
CREATE TABLE IF NOT EXISTS city_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS city_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES city_groups(id) ON DELETE CASCADE,
  location_id UUID REFERENCES monitored_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, location_id)
);

CREATE INDEX idx_city_group_members_group ON city_group_members(group_id);
CREATE INDEX idx_city_group_members_location ON city_group_members(location_id);

-- DOWN
-- DROP TABLE IF EXISTS city_group_members;
-- DROP TABLE IF EXISTS city_groups;
