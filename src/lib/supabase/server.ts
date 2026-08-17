import { createServerClient, type CookieOptions } from '@supabase/ssr';

type Cookie = { name: string; value: string; options?: CookieOptions };
import { cookies } from 'next/headers';

/** Sessão da comissão/consultoria. Respeita RLS. */
export async function supabaseServidor() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (lista: Cookie[]) => {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component: o middleware já renova a sessão
          }
        },
      },
    },
  );
}
