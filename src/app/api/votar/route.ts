import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonimo } from '@/lib/supabase/anon';
import { ipDaRequisicao } from '@/lib/ip';
import { mensagemDoErro, codigoDoErro } from '@/lib/erros';
import { cpfValido, somenteDigitos } from '@/lib/cpf';
import type { TipoVoto } from '@/lib/types';

type Corpo = {
  origem: 'LINK_MAGICO' | 'QR_CODE';
  tipo_voto: TipoVoto;
  candidato_id?: string | null;
  token?: string;
  eleicao_id?: string;
  cpf?: string;
  nome?: string;
  cargo?: string;
};

export async function POST(req: NextRequest) {
  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mensagem: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = supabaseAnonimo();
  const ip = ipDaRequisicao(req);
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null;
  const tipo: TipoVoto = corpo.tipo_voto ?? 'NOMINAL';
  const candidato = tipo === 'NOMINAL' ? corpo.candidato_id ?? null : null;

  const chamada =
    corpo.origem === 'LINK_MAGICO'
      ? supabase.rpc('registrar_voto_link', {
          p_token: corpo.token,
          p_tipo_voto: tipo,
          p_candidato_id: candidato,
          p_ip: ip,
          p_user_agent: userAgent,
        })
      : supabase.rpc('registrar_voto_qr', {
          p_eleicao_id: corpo.eleicao_id,
          p_cpf: somenteDigitos(corpo.cpf ?? ''),
          p_nome: corpo.nome?.trim(),
          p_cargo: corpo.cargo?.trim() || null,
          p_tipo_voto: tipo,
          p_candidato_id: candidato,
          p_ip: ip,
          p_user_agent: userAgent,
        });

  if (corpo.origem === 'QR_CODE' && !cpfValido(corpo.cpf ?? '')) {
    return NextResponse.json({ ok: false, codigo: 'CPF_INVALIDO', mensagem: mensagemDoErro('CPF_INVALIDO') }, { status: 422 });
  }

  const { data, error } = await chamada;

  if (error) {
    return NextResponse.json(
      { ok: false, codigo: codigoDoErro(error), mensagem: mensagemDoErro(error) },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, resultado: data });
}
