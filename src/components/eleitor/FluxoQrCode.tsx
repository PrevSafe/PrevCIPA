'use client';
import { useState } from 'react';
import { Urna } from './Urna';
import { cpfValido, formatarCpf, somenteDigitos } from '@/lib/cpf';
import type { Cedula } from '@/lib/types';

/**
 * Porta B: quem não recebeu link se identifica na hora. A conferência com a
 * lista do RH acontece depois, no painel — aqui não barramos ninguém por
 * ausência de cadastro, só por CPF inválido.
 */
export function FluxoQrCode({ cedula }: { cedula: Cedula }) {
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [identificado, setIdentificado] = useState(false);

  if (identificado) {
    return (
      <Urna
        cedula={cedula}
        saudacao={nome.trim().split(' ')[0]}
        identificacao={{
          origem: 'QR_CODE',
          eleicao_id: cedula.eleicao.id,
          cpf: somenteDigitos(cpf),
          nome: nome.trim(),
          cargo: cargo.trim() || null,
        }}
      />
    );
  }

  function avancar() {
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.');
    if (nome.trim().split(/\s+/).length < 2) return setErro('Escreva seu nome completo.');
    setErro(null);
    setIdentificado(true);
  }

  const empresa = cedula.empresa.nome_fantasia || cedula.empresa.razao_social;

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="rotulo">{empresa} · {cedula.eleicao.tipo}</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight">
        Identifique-se para votar
      </h1>
      <p className="mt-2 text-grafite-medio">
        Seus dados servem só para provar que você votou uma vez. Eles não ficam ligados
        ao seu voto.
      </p>

      <div className="mt-8 grid gap-5">
        <label className="grid gap-2">
          <span className="rotulo">CPF</span>
          <input
            className="campo font-mono text-2xl tracking-wider"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={formatarCpf(cpf)}
            onChange={(e) => setCpf(somenteDigitos(e.target.value).slice(0, 11))}
          />
        </label>

        <label className="grid gap-2">
          <span className="rotulo">Nome completo</span>
          <input
            className="campo"
            autoComplete="name"
            placeholder="Como está no crachá"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>

        <label className="grid gap-2">
          <span className="rotulo">Função <span className="normal-case tracking-normal">(opcional)</span></span>
          <input
            className="campo"
            placeholder="Ex.: Soldador"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
        </label>

        {erro && (
          <p role="alert" className="rounded-xl bg-alerta-claro px-4 py-3 text-sm font-medium text-alerta">
            {erro}
          </p>
        )}

        <button type="button" onClick={avancar} className="botao-primario h-16 text-base">
          Ver os candidatos
        </button>
      </div>
    </div>
  );
}
