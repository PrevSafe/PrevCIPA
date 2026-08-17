import Link from 'next/link';
import { supabaseServidor } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CORES: Record<string, string> = {
  RASCUNHO: 'bg-concreto-escuro text-grafite-medio',
  AGENDADA: 'bg-ambar-claro text-ambar',
  ABERTA: 'bg-cipa-claro text-cipa',
  ENCERRADA: 'bg-grafite text-white',
  APURADA: 'bg-grafite text-white',
  CANCELADA: 'bg-alerta-claro text-alerta',
};

export default async function ListaEleicoes() {
  const supabase = await supabaseServidor();
  const { data: eleicoes } = await supabase
    .from('eleicoes')
    .select('id, titulo, tipo, status, data_inicio, data_fim, total_eleitores_aptos, empresas_clientes(razao_social)')
    .order('data_inicio', { ascending: false });

  return (
    <div>
      <p className="rotulo">Eleições</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Suas eleições</h1>

      {!eleicoes?.length && (
        <div className="cartao mt-8 p-8">
          <p className="font-display text-xl font-bold">Nenhuma eleição ainda</p>
          <p className="mt-2 text-grafite-medio">
            Crie a primeira eleição pelo Supabase Studio ou pela rotina de cadastro da consultoria,
            depois importe a lista do RH e cadastre os candidatos.
          </p>
        </div>
      )}

      <ul className="mt-8 grid gap-3">
        {eleicoes?.map((e) => (
          <li key={e.id}>
            <Link href={`/painel/eleicoes/${e.id}`} className="cartao flex items-center gap-6 p-5 hover:border-grafite-claro">
              <div className="min-w-0 flex-1">
                <p className="rotulo">
                  {(e.empresas_clientes as unknown as { razao_social: string } | null)?.razao_social ?? '—'} · {e.tipo}
                </p>
                <p className="mt-1 truncate font-display text-xl font-bold">{e.titulo}</p>
                <p className="mt-1 text-sm text-grafite-medio">
                  {new Date(e.data_inicio).toLocaleDateString('pt-BR')} a {new Date(e.data_fim).toLocaleDateString('pt-BR')}
                  {' · '}{e.total_eleitores_aptos} aptos
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 font-display text-[11px] font-bold uppercase tracking-wider ${CORES[e.status] ?? ''}`}>
                {e.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
