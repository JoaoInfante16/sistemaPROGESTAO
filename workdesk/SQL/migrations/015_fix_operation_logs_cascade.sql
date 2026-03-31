-- Migration 015: Adicionar CASCADE na FK operation_logs.location_id
-- Permite deletar estados/cidades sem violar constraint de logs.

ALTER TABLE operation_logs
DROP CONSTRAINT IF EXISTS operation_logs_location_id_fkey;

ALTER TABLE operation_logs
ADD CONSTRAINT operation_logs_location_id_fkey
FOREIGN KEY (location_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;
