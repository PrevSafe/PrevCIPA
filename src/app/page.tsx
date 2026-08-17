import Link from 'next/link';

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="rotulo">NR-05 · NR-31</p>
      <h1 className="mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-tight">
        Eleição de CIPA<br />sem papel, sem fila.
      </h1>
      <p className="mt-5 max-w-md text-lg text-grafite-medio">
        O eleitor entra pelo link ou pelo QR Code do mural. A comissão confere quem votou —
        e nunca em quem.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/login" className="botao-primario">Entrar no painel</Link>
      </div>
      <p className="mt-16 text-sm text-grafite-claro">
        Já recebeu um link para votar? Abra o link que você recebeu por e-mail ou WhatsApp,
        ou leia o QR Code afixado no mural.
      </p>
    </main>
  );
}
