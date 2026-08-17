import type { NextRequest } from 'next/server';

/**
 * O PostgREST enxerga o IP do proxy, não o do eleitor. Capturamos aqui e
 * passamos como parâmetro da RPC. Nunca aceitar IP vindo do corpo da requisição.
 */
export function ipDaRequisicao(req: NextRequest): string | null {
  const encaminhado = req.headers.get('x-forwarded-for');
  if (encaminhado) return encaminhado.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? null;
}
