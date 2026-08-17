'use client';
import { useState, useTransition } from 'react';
import { criarCandidato } from '@/app/(painel)/painel/eleicoes/[id]/actions';
import { Aviso } from './Aviso';

export function FormCandidato({ eleicaoId }: { eleicaoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);

  return (
    <form
      className="cartao mt-8 p-6"
      action={(dados) =>
        iniciar(async () => {
          const r = await criarCandidato(eleicaoId, dados);
          setAviso({ tom: r.ok ? 'ok' : 'erro', texto: r.mensagem });
        })
      }
    >
      <p className="rotulo">Inscrição</p>
      <h2 className="mt-2 font-display text-xl font-bold">Cadastrar candidato</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="rotulo">Número na urna</span>
          <input name="numero_urna" inputMode="numeric" className="campo font-mono" placeholder="10" />
        </label>
        <label className="grid gap-2">
          <span className="rotulo">Nome na urna</span>
          <input name="nome_urna" required className="campo" placeholder="Como é conhecido" />
        </label>
        <label className="grid gap-2 sm:col-span-2">
          <span className="rotulo">Nome completo</span>
          <input name="nome_completo" required className="campo" />
        </label>
        <label className="grid gap-2">
          <span className="rotulo">Função</span>
          <input name="cargo_funcao" className="campo" />
        </label>
        <label className="grid gap-2">
          <span className="rotulo">Setor</span>
          <input name="setor" className="campo" />
        </label>
      </div>

      <button className="botao-primario mt-5 h-12" disabled={pendente}>
        {pendente ? 'Salvando…' : 'Cadastrar candidato'}
      </button>

      {aviso && <Aviso tom={aviso.tom} texto={aviso.texto} />}
    </form>
  );
}
