import { createClient } from '@supabase/supabase-js';

/**
 * Cliente sem sessão, usado no servidor para as 4 RPCs públicas do eleitor.
 * O PWA nunca fala com o Supabase direto: passa pelas Route Handlers, que são
 * quem consegue ler o IP real do dispositivo.
 */
export function supabaseAnonimo() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
