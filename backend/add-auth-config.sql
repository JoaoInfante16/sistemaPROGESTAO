-- Adicionar config de autenticação obrigatória
INSERT INTO system_config (key, value, description, category, value_type)
VALUES ('auth_required', 'true', 'Requer autenticação no app mobile (se false, app funciona sem login)', 'auth', 'boolean')
ON CONFLICT (key) DO NOTHING;
