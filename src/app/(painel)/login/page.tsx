'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';

function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);

    const { error } = await supabaseNavegador().auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro('E-mail ou senha não conferem.');
      setEntrando(false);
      return;
    }
    router.replace(parametros.get('continuar') ?? '/painel');
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="mt-8 grid gap-5">
      <label className="grid gap-2">
        <span className="rotulo">E-mail</span>
        <input className="campo" type="email" autoComplete="email" required
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="rotulo">Senha</span>
        <input className="campo" type="password" autoComplete="current-password" required
               value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>

      {erro && (
        <p role="alert" className="rounded-xl bg-alerta-claro px-4 py-3 text-sm font-medium text-alerta">
          {erro}
        </p>
      )}

      <button className="botao-primario h-14" disabled={entrando}>
        {entrando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <p className="rotulo">Acesso restrito</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Entrar no painel</h1>
      <Suspense fallback={<p className="mt-8 text-grafite-medio">Carregando…</p>}>
        <FormularioLogin />
      </Suspense>
    </div>
  );
}
