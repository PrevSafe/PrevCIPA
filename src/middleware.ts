import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type Cookie = { name: string; value: string; options?: CookieOptions };

/** Renova a sessão da comissão e barra /painel para quem não está autenticado. */
export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista: Cookie[]) => {
          lista.forEach(({ name, value }) => req.cookies.set(name, value));
          resposta = NextResponse.next({ request: req });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && req.nextUrl.pathname.startsWith('/painel')) {
    const destino = req.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('continuar', req.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: ['/painel/:path*', '/login'],
};
