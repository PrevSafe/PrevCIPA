export function TelaAviso({
  tom = 'neutro', titulo, descricao,
}: {
  tom?: 'neutro' | 'atencao' | 'erro';
  titulo: string;
  descricao: string;
}) {
  const cor =
    tom === 'erro' ? 'bg-alerta' : tom === 'atencao' ? 'bg-ambar' : 'bg-grafite-medio';

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <span aria-hidden className={`h-2 w-16 rounded-full ${cor}`} />
      <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight">{titulo}</h1>
      <p className="mt-3 text-lg text-grafite-medio">{descricao}</p>
      <p className="mt-10 text-sm text-grafite-claro">
        Em caso de dúvida, procure o SESMT ou a comissão eleitoral da sua empresa.
      </p>
    </div>
  );
}
