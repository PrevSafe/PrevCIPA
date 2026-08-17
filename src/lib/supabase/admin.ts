import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * service_role: ignora RLS. Só para onboarding de perfis e rotinas internas.
 * Se esta chave aparecer em qualquer bundle do cliente, o sigilo do voto acabou.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
