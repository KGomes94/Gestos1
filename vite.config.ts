
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente baseadas no modo (ex: .env)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: '/', 
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    },
    // Define process.env globalmente para compatibilidade com o código existente e injeta a chave fornecida
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Client ID do Google - Usa o ID fornecido como fallback
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || '553528521350-brfoh127vbtbumfuesdp1qanir8q7734.apps.googleusercontent.com'),
      // URL do Supabase fornecida
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://cjawpnhtkfdnugbgobnu.supabase.co'),
      // Chave Anónima fornecida
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Cv4xUY1fGk4EFqznV-jmuQ_Uo93ADAx')
    }
  };
});
