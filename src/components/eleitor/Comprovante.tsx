export function Comprovante({
  emAnalise = false, nomeEmpresa, titulo,
}: {
  emAnalise?: boolean;
  nomeEmpresa: string;
  titulo: string;
}) {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <div className="cartao animate-entrar p-8">
        <span
          aria-hidden
          className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl text-white
            ${emAnalise ? 'bg-ambar' : 'bg-cipa'}`}
        >
          {emAnalise ? '⏳' : '✓'}
        </span>

        <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight">
          {emAnalise ? 'Voto enviado para conferência' : 'Voto registrado'}
        </h1>

        <p className="mt-3 text-grafite-medio">
          {emAnalise
            ? 'A comissão eleitoral vai conferir seu CPF com a lista do RH. Você não precisa votar de novo — e não conseguirá votar duas vezes.'
            : 'Seu nome entrou na lista de presença da eleição. Em quem você votou não fica registrado em nenhum lugar.'}
        </p>

        <dl className="mt-8 space-y-3 border-t border-concreto-escuro pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-grafite-claro">Empresa</dt>
            <dd className="text-right font-medium">{nomeEmpresa}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-grafite-claro">Eleição</dt>
            <dd className="text-right font-medium">{titulo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-grafite-claro">Data e hora</dt>
            <dd className="text-right font-mono font-medium">{agora}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-8 text-center text-sm text-grafite-claro">
        Pode fechar esta página.
      </p>
    </div>
  );
}
