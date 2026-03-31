-- Migration 014: Adicionar coluna password_reset_requested em user_profiles
-- Permite que usuarios solicitem reset de senha pelo app,
-- e o admin veja o pedido no painel.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS password_reset_requested BOOLEAN DEFAULT false;
