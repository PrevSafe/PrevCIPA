'use client';
import { useState } from 'react';
import { markdownParaHtml } from '@/lib/markdown';
import { Aviso } from './Aviso';

export function GeradorAta({ eleicaoId, ataSalva }: { eleicaoId: string; ataSalva: string | null }) {
  const [markdown, setMarkdown] = useState<string | null>(ataSalva);
  const [carregando, setCarregando] = useState<null | 'ELEICAO' | 'POSSE'>(null);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);

  async function gerar(documento: 'ELEICAO' | 'POSSE') {
    setCarregando(documento);
    setAviso(null);
    try {
      const resposta = await fetch('/api/ata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eleicao_id: eleicaoId, documento }),
      });
      const dados = await resposta.json();

      if (!dados.ok) {
        setAviso({ tom: 'erro', texto: dados.mensagem ?? 'Não foi possível gerar a ata.' });
        return;
      }
      setMarkdown(dados.markdown);
      setAviso({ tom: 'ok', texto: 'Ata gerada a partir do modelo padrão. Confira os dados antes de assinar.' });
    } catch {
      setAviso({ tom: 'erro', texto: 'Falha de rede ao encerrar a eleição. Tente novamente.' });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="mt-8">
      <div className="nao-imprimir flex flex-wrap gap-3">
        <button className="botao-primario h-12" disabled={!!carregando} onClick={() => gerar('ELEICAO')}>
          {carregando === 'ELEICAO' ? 'Redigindo…' : 'Encerrar e gerar ata de apuração'}
        </button>
        <button className="botao-secundario h-12" disabled={!!carregando} onClick={() => gerar('POSSE')}>
          {carregando === 'POSSE' ? 'Redigindo…' : 'Gerar ata de posse'}
        </button>
        {markdown && (
          <button className="botao-secundario h-12" onClick={() => window.print()}>
            Imprimir / salvar em PDF
          </button>
        )}
      </div>

      {aviso && <div className="nao-imprimir"><Aviso tom={aviso.tom} texto={aviso.texto} /></div>}

      {markdown && (
        <article
          className="cartao mt-6 p-10 leading-relaxed
            [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mb-4
            [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-2
            [&_h3]:font-display [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-1
            [&_p]:mb-3 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1
            [&_hr]:my-8 [&_hr]:border-concreto-escuro
            [&_table]:w-full [&_table]:my-5 [&_table]:text-sm
            [&_th]:border-b-2 [&_th]:border-grafite [&_th]:py-2 [&_th]:text-left [&_th]:font-display [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider
            [&_td]:border-b [&_td]:border-concreto-escuro [&_td]:py-2"
          dangerouslySetInnerHTML={{ __html: markdownParaHtml(markdown) }}
        />
      )}

      <p className="nao-imprimir mt-6 max-w-2xl text-sm text-grafite-claro">
        A ata é preenchida a partir de modelo fixo com os números apurados no banco — a mesma
        eleição gera sempre o mesmo texto. A conferência e a assinatura continuam sendo
        responsabilidade da comissão eleitoral.
      </p>
    </div>
  );
}
