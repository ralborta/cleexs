-- Fase 3: Freemium vs Gold - permitir múltiples diagnósticos por dominio
-- Removemos unique para poder detectar "primera corrida" vs repeticiones
DROP INDEX IF EXISTS "public_diagnostics_domain_key";
