import Link from 'next/link';

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-concreto">
      <header className="nao-imprimir border-b border-concreto-escuro bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/painel" className="font-display text-lg font-extrabold tracking-tight">
            CIPA<span className="text-cipa">Digital</span>
          </Link>
          <span className="rotulo">Painel da comissão</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
