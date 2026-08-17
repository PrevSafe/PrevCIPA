'use client';
import Image from 'next/image';
import type { CandidatoCedula } from '@/lib/types';

/**
 * O número da urna é o elemento dominante: é o que o trabalhador reconhece
 * do voto em papel e do que está afixado no mural.
 */
export function CardCandidato({
  candidato, selecionado, aoSelecionar,
}: {
  candidato: CandidatoCedula;
  selecionado: boolean;
  aoSelecionar: () => void;
}) {
  const iniciais = candidato.nome_urna
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={aoSelecionar}
      aria-pressed={selecionado}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition
        ${selecionado
          ? 'border-cipa shadow-[0_0_0_4px_rgba(11,110,79,0.12)]'
          : 'border-concreto-escuro hover:border-grafite-claro'}`}
    >
      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-concreto">
        {candidato.foto_url ? (
          <Image src={candidato.foto_url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-grafite-claro">
            {iniciais}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        {candidato.numero_urna !== null && (
          <span className="block font-mono text-3xl font-bold leading-none tracking-tight text-grafite">
            {String(candidato.numero_urna).padStart(2, '0')}
          </span>
        )}
        <span className="mt-1 block truncate font-display text-xl font-bold leading-tight">
          {candidato.nome_urna}
        </span>
        {candidato.cargo_funcao && (
          <span className="mt-0.5 block truncate text-sm text-grafite-medio">
            {candidato.cargo_funcao}
            {candidato.setor ? ` · ${candidato.setor}` : ''}
          </span>
        )}
      </span>

      <span
        aria-hidden
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-white
          ${selecionado ? 'border-cipa bg-cipa' : 'border-concreto-escuro'}`}
      >
        {selecionado ? '✓' : ''}
      </span>
    </button>
  );
}
