'use client';

export function BotaoImprimir({ rotulo = 'Imprimir' }: { rotulo?: string }) {
  return (
    <button type="button" className="botao-secundario h-11" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
