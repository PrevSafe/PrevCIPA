import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/server';
import { gerarAta, promptAtaEleicao, promptAtaPosse } from '@/lib/gemini';
import { mensagemDoErro } from '@/lib/erros';
import type { PayloadApuracao } from '@/lib/types';

/**
 * Encerra a eleição (a RPC recusa se houver quarentena pendente), monta o payload
 * consolidado e pede a ata ao Gemini. O Markdown volta para o painel e fica salvo.
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

  try {
    const dados = payload as PayloadApuracao;
    const markdown = await gerarAta(
      documento === 'POSSE' ? promptAtaPosse(dados) : promptAtaEleicao(dados),
    );

    await supabase
      .from('eleicoes')
      .update(documento === 'POSSE' ? { ata_posse_md: markdown } : { ata_eleicao_md: markdown })
      .eq('id', eleicao_id);

    return NextResponse.json({ ok: true, markdown, payload: dados });
  } catch (e) {
    // A eleição já foi encerrada com sucesso: a falha é só na redação.
    return NextResponse.json(
      {
        ok: false,
        parcial: true,
        payload,
        mensagem: 'Eleição encerrada e apurada, mas a redação da ata falhou: ' + (e as Error).message,
      },
      { status: 502 },
    );
  }
}
