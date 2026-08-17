'use client';
import { useState } from 'react';
import { CardCandidato } from './CardCandidato';
import { BottomSheetConfirmacao } from './BottomSheetConfirmacao';
import { Comprovante } from './Comprovante';
import type { Cedula, TipoVoto } from '@/lib/types';

export type Identificacao =
  | { origem: 'LINK_MAGICO'; token: string }
  | { origem: 'QR_CODE'; eleicao_id: string; cpf: string; nome: string; cargo: string | null };

type Escolha =
  | { tipo: 'NOMINAL'; candidato_id: string; rotulo: string; numero: number | null; detalhe: string | null }
  | { tipo: 'BRANCO' | 'NULO'; rotulo: string; numero: null; detalhe: string | null };

export function Urna({
  cedula, identificacao, saudacao,
}: {
  cedula: Cedula;
  identificacao: Identificacao;
  saudacao?: string;
}) {
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<null | 'sucesso' | 'quarentena'>(null);

  const empresa = cedula.empresa.nome_fantasia || cedula.empresa.razao_social;

  async function enviar() {
    if (!escolha) return;
    setEnviando(true);
    setErro(null);

    const corpo: Record<string, unknown> = {
      ...identificacao,
      tipo_voto: escolha.tipo as TipoVoto,
      candidato_id: escolha.tipo === 'NOMINAL' ? escolha.candidato_id : null,
    };

    try {
      const resposta = await fetch('/api/votar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();

      if (!dados.ok) {
        setErro(dados.mensagem ?? 'Não foi possível registrar o voto.');
        return;
      }
      setConcluido(dados.resultado?.status === 'quarentena' ? 'quarentena' : 'sucesso');
    } catch {
      setErro('Sem conexão. Verifique a internet e toque em confirmar de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <Comprovante
        emAnalise={concluido === 'quarentena'}
        nomeEmpresa={empresa}
        titulo={cedula.eleicao.titulo}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-40 pt-8">
      <header>
        <p className="rotulo">{empresa} · {cedula.eleicao.tipo}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight">
          {saudacao ? `${saudacao}, escolha seu representante` : 'Escolha seu representante'}
        </h1>
        <p className="mt-2 text-grafite-medio">
          {cedula.eleicao.titulo}. Um voto por pessoa. Ninguém vê em quem você votou.
        </p>
      </header>

      <div className="mt-8 grid gap-3">
        {cedula.candidatos.map((c) => (
          <CardCandidato
            key={c.id}
            candidato={c}
            selecionado={escolha?.tipo === 'NOMINAL' && escolha.candidato_id === c.id}
            aoSelecionar={() =>
              setEscolha({
                tipo: 'NOMINAL',
                candidato_id: c.id,
                rotulo: c.nome_urna,
                numero: c.numero_urna,
                detalhe: c.cargo_funcao,
              })
            }
          />
        ))}
      </div>

      {(cedula.eleicao.permite_voto_branco || cedula.eleicao.permite_voto_nulo) && (
        <div className="mt-8">
          <p className="rotulo">Não quero votar em ninguém</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {cedula.eleicao.permite_voto_branco && (
              <button
                type="button"
                onClick={() => setEscolha({ tipo: 'BRANCO', rotulo: 'Voto em branco', numero: null, detalhe: 'Não escolhe nenhum candidato, mas conta no quórum.' })}
                className={`rounded-2xl border-2 bg-white px-4 py-5 font-display font-bold
                  ${escolha?.tipo === 'BRANCO' ? 'border-cipa' : 'border-concreto-escuro'}`}
              >
                Branco
              </button>
            )}
            {cedula.eleicao.permite_voto_nulo && (
              <button
                type="button"
                onClick={() => setEscolha({ tipo: 'NULO', rotulo: 'Voto nulo', numero: null, detalhe: 'Não escolhe nenhum candidato, mas conta no quórum.' })}
                className={`rounded-2xl border-2 bg-white px-4 py-5 font-display font-bold
                  ${escolha?.tipo === 'NULO' ? 'border-cipa' : 'border-concreto-escuro'}`}
              >
                Nulo
              </button>
            )}
          </div>
        </div>
      )}

      {escolha && !confirmando && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-concreto-escuro bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="rotulo">Sua escolha</p>
              <p className="truncate font-display text-lg font-bold">{escolha.rotulo}</p>
            </div>
            <button type="button" onClick={() => setConfirmando(true)} className="botao-primario h-14 px-8">
              Revisar
            </button>
          </div>
        </div>
      )}

      {escolha && confirmando && (
        <BottomSheetConfirmacao
          titulo={escolha.rotulo}
          descricao={escolha.detalhe}
          numero={escolha.numero}
          enviando={enviando}
          erro={erro}
          aoConfirmar={enviar}
          aoCorrigir={() => { setConfirmando(false); setErro(null); }}
        />
      )}
    </div>
  );
}
