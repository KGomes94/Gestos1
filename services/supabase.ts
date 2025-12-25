
import { createClient } from '@supabase/supabase-js';

// Estas variáveis devem ser configuradas no ficheiro .env ou no painel da Vercel
// Usamos process.env pois definimos explicitamente no vite.config.ts para garantir a substituição estática
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Previne crash da aplicação se as variáveis estiverem vazias durante a inicialização
// Cria um cliente "dummy" se faltar configuração, mas as funções de sync verificarão isSupabaseConfigured()
export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder');

export const isSupabaseConfigured = () => {
    return supabaseUrl !== '' && supabaseAnonKey !== '' && supabaseUrl !== 'https://placeholder.supabase.co';
};
