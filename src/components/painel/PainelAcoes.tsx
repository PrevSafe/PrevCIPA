'use client';
import { useState, useTransition } from 'react';
import { abrirEleicao } from '@/app/(painel)/painel/eleicoes/[id]/actions';
import { Aviso } from './Aviso';

export function PainelAcoes({ eleicaoId, status }: { eleicaoId: string; status: string }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);

  if (status !== 'RASCUNHO' && status !== 'AGENDADA') return null;

  return (
    <div className="mt-6">
      <button
        className="botao-primario h-12"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await abrirEleicao(eleicaoId);
            setAviso({ tom: r.ok ? 'ok' : 'erro', texto: r.mensagem });
          })
        }
      >
        {pendente ? 'Abrindo…' : 'Abrir votação'}
      </button>
      <p className="mt-3 max-w-xl text-sm text-grafite-medio">
        Abrir exige lista do RH importada e pelo menos um candidato deferido. Depois de aberta,
        os links mágicos e o QR Code do mural passam a aceitar votos.
      </p>
      {aviso && <Aviso tom={aviso.tom} texto={aviso.texto} />}
    </div>
  );
}
