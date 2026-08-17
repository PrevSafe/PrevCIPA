'use client';
import { useState, useTransition } from 'react';
import { gerarTokens } from '@/app/(painel)/painel/eleicoes/[id]/actions';
import { Aviso } from './Aviso';

/**
 * O token só existe em claro nesta tela, uma vez. O banco guarda o hash.
 * Por isso o CSV é baixado na hora, e não fica salvo em lugar nenhum.
 */
export function GeradorLinks({ eleicaoId }: { eleicaoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);

  function baixar(linhas: string[]) {
    const conteudo = 'nome;contato;link\n' + linhas.join('\n');
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `links-magicos-${eleicaoId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cartao mt-6 p-6">
      <p className="rotulo">Links mágicos</p>
      <h2 className="mt-2 font-display text-xl font-bold">Gerar e baixar os links</h2>
      <p className="mt-2 max-w-2xl text-grafite-medio">
        Gera um link por eleitor que ainda não votou e ainda não tem link. O arquivo baixa na hora —
        os links não podem ser recuperados depois, só regerados.
      </p>

      <button
        className="botao-primario mt-5 h-12"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await gerarTokens(eleicaoId);
            setAviso({ tom: r.ok ? 'ok' : 'erro', texto: r.mensagem });
            if (r.ok && r.links?.length) baixar(r.links);
          })
        }
      >
        {pendente ? 'Gerando…' : 'Gerar links e baixar CSV'}
      </button>

      {aviso && <Aviso tom={aviso.tom} texto={aviso.texto} />}
    </div>
  );
}
