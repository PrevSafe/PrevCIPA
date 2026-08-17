'use client';

export function Aviso({ tom, texto }: { tom: 'ok' | 'erro'; texto: string }) {
  return (
    <p
      role="status"
      className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
        tom === 'ok' ? 'bg-cipa-claro text-cipa' : 'bg-alerta-claro text-alerta'
      }`}
    >
      {texto}
    </p>
  );
}
