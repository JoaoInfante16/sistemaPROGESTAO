import { createClient } from '@supabase/supabase-js';
import { config } from './index';

// Client com service key (backend - acesso total)
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// Client com anon key (para verificar tokens de usuários)
export const supabaseAuth = createClient(config.supabaseUrl, config.supabaseAnonKey);
