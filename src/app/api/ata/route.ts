import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/server';
import { montarAtaEleicao, montarAtaPosse } from '@/lib/ata';
import { mensagemDoErro } from '@/lib/erros';
import type { PayloadApuracao } from '@/lib/types';

/**
 * Encerra a eleição (a RPC recusa se houver quarentena pendente), consolida a
 * apuração e preenche o modelo de ata. Determinístico: mesma eleição, mesmo texto.
 */
export async function POST(req: NextRequest) {
  const { eleicao_id, documento = 'ELEICAO' } = await req.json();
  const supabase = await supabaseServidor();

  const { data: payload, error } = await supabase.rpc('encerrar_eleicao', {
    p_eleicao_id: eleicao_id,
  });

  if (error) {
    return NextResponse.json({ ok: false, mensagem: mensagemDoErro(error) }, { status: 422 });
  }

  const dados = payload as PayloadApuracao;
  const markdown = documento === 'POSSE' ? montarAtaPosse(dados) : montarAtaEleicao(dados);

  const { error: erroSalvar } = await supabase
    .from('eleicoes')
    .update(documento === 'POSSE' ? { ata_posse_md: markdown } : { ata_eleicao_md: markdown })
    .eq('id', eleicao_id);

  return NextResponse.json({
    ok: true,
    markdown,
    payload: dados,
    salvo: !erroSalvar,
  });
}
