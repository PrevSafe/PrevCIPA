'use client';
import { useState, useTransition } from 'react';
import { aprovarEnvelope, aprovarLote, rejeitarEnvelope } from '@/app/(painel)/painel/eleicoes/[id]/actions';
import { Aviso } from './Aviso';
import type { EnvelopeQuarentena } from '@/lib/types';

const ALERTAS: Record<EnvelopeQuarentena['alerta'], { texto: string; classe: string }> = {
  OK: { texto: '✅ Confere com o RH', classe: 'bg-cipa-claro text-cipa' },
  CPF_NAO_ENCONTRADO_RH: { texto: '⚠️ CPF não está na lista do RH', classe: 'bg-ambar-claro text-ambar' },
  DIVERGENCIA_NOME: { texto: '⚠️ Nome diverge do RH', classe: 'bg-ambar-claro text-ambar' },
  TENTATIVA_DUPLICADA: { texto: '🚨 CPF já assinou a lista', classe: 'bg-alerta-claro text-alerta' },
  MULTIPLOS_VOTOS_MESMO_IP: { texto: '⚠️ Muitos votos do mesmo aparelho', classe: 'bg-ambar-claro text-ambar' },
};

export function FilaQuarentena({
  eleicaoId, envelopes,
}: {
  eleicaoId: string;
  envelopes: EnvelopeQuarentena[];
}) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);

  const confereis = envelopes.filter((e) => e.alerta === 'OK').map((e) => e.id);

  function executar(acao: () => Promise<{ ok: boolean; mensagem: string }>) {
    iniciar(async () => {
      const r = await acao();
      setAviso({ tom: r.ok ? 'ok' : 'erro', texto: r.mensagem });
    });
  }

  if (!envelopes.length) {
    return (
      <div className="cartao mt-8 p-8">
        <p className="font-display text-xl font-bold">Nada para conferir</p>
        <p className="mt-2 text-grafite-medio">
          Votos enviados pelo QR Code do mural aparecem aqui até você aprovar ou rejeitar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {confereis.length > 1 && (
        <button
          className="botao-primario h-11"
          disabled={pendente}
          onClick={() => executar(() => aprovarLote(eleicaoId, confereis))}
        >
          Aprovar os {confereis.length} que conferem
        </button>
      )}

      {aviso && <Aviso tom={aviso.tom} texto={aviso.texto} />}

      <ul className="mt-6 grid gap-3">
        {envelopes.map((e) => {
          const alerta = ALERTAS[e.alerta];
          return (
            <li key={e.id} className="cartao p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">{e.nome_declarado}</p>
                  <p className="mt-1 font-mono text-sm text-grafite-medio">{e.cpf_mascara}</p>
                  <p className="mt-1 text-sm text-grafite-medio">
                    {e.cargo_declarado ?? 'Função não informada'} ·{' '}
                    {new Date(e.data_hora).toLocaleString('pt-BR')}
                  </p>
                  {e.nome_rh && (
                    <p className="mt-2 text-sm">
                      <span className="rotulo">No RH:</span>{' '}
                      <span className="font-medium">{e.nome_rh}</span>
                      {e.cargo_rh ? ` · ${e.cargo_rh}` : ''}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alerta.classe}`}>
                  {alerta.texto}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="botao-primario h-10 text-xs"
                  disabled={pendente}
                  onClick={() => executar(() => aprovarEnvelope(eleicaoId, e.id))}
                >
                  Aprovar e computar
                </button>
                <button
                  className="botao-secundario h-10 border-alerta text-xs text-alerta"
                  disabled={pendente}
                  onClick={() => {
                    const motivo = window.prompt('Motivo da rejeição (fica no log de auditoria):');
                    if (motivo) executar(() => rejeitarEnvelope(eleicaoId, e.id, motivo));
                  }}
                >
                  Rejeitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 max-w-2xl text-sm text-grafite-claro">
        Você confere identidade, nunca escolha. Em quem cada pessoa votou não é legível
        neste painel — o banco não concede permissão de leitura nessa coluna.
      </p>
    </div>
  );
}
