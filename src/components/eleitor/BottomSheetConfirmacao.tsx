'use client';
import { useEffect } from 'react';

/**
 * Último passo antes do irreversível. A faixa listrada no topo é a mesma
 * marcação usada no piso de fábrica para delimitar zona de risco.
 */
export function BottomSheetConfirmacao({
  titulo, descricao, numero, enviando, erro, aoConfirmar, aoCorrigir,
}: {
  titulo: string;
  descricao?: string | null;
  numero?: number | null;
  enviando: boolean;
  erro: string | null;
  aoConfirmar: () => void;
  aoCorrigir: () => void;
}) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) aoCorrigir(); };
    window.addEventListener('keydown', fechar);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fechar); document.body.style.overflow = ''; };
  }, [enviando, aoCorrigir]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-grafite/60" onClick={() => !enviando && aoCorrigir()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmação do voto"
        className="relative w-full max-w-xl animate-subir overflow-hidden rounded-t-3xl bg-white shadow-urna"
      >
        <div className="faixa-seguranca h-2" aria-hidden />

        <div className="px-6 pb-8 pt-6">
          <p className="rotulo">Confira antes de confirmar</p>

          <div className="mt-4 flex items-baseline gap-4">
            {numero !== null && numero !== undefined && (
              <span className="font-mono text-5xl font-bold leading-none">
                {String(numero).padStart(2, '0')}
              </span>
            )}
            <span className="font-display text-3xl font-extrabold leading-tight">{titulo}</span>
          </div>
          {descricao && <p className="mt-2 text-grafite-medio">{descricao}</p>}

          <p className="mt-5 text-sm text-grafite-medio">
            Depois de confirmar, o voto não pode ser alterado.
          </p>

          {erro && (
            <p role="alert" className="mt-4 rounded-xl bg-alerta-claro px-4 py-3 text-sm font-medium text-alerta">
              {erro}
            </p>
          )}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={aoConfirmar}
              disabled={enviando}
              className="botao-primario h-16 text-base"
            >
              {enviando ? 'Registrando…' : 'Confirmar voto'}
            </button>
            <button
              type="button"
              onClick={aoCorrigir}
              disabled={enviando}
              className="botao-secundario h-14 border-ambar text-ambar"
            >
              Corrigir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
