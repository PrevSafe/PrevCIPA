import { supabaseServidor } from '@/lib/supabase/server';
import { FormCandidato } from '@/components/painel/FormCandidato';

export const dynamic = 'force-dynamic';

export default async function Candidatos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const [{ data: candidatos }, { data: eleicao }] = await Promise.all([
    supabase.from('candidatos')
      .select('id, numero_urna, nome_urna, nome_completo, cargo_funcao, setor, inscricao_status')
      .eq('eleicao_id', id)
      .order('numero_urna', { nullsFirst: false }),
    supabase.from('eleicoes').select('status').eq('id', id).single(),
  ]);

  const urnaAberta = eleicao?.status === 'ABERTA';

  return (
    <div>
      <p className="rotulo">Inscrições</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Candidatos</h1>
      <p className="mt-2 max-w-2xl text-grafite-medio">
        Só candidatos com inscrição deferida aparecem na cédula. A contagem de votos não é exibida
        aqui — nem depois do encerramento, para não misturar cadastro com apuração.
      </p>

      {urnaAberta && (
        <p className="mt-4 rounded-xl bg-ambar-claro px-4 py-3 text-sm font-medium text-ambar">
          A urna está aberta. Alterar a cédula agora muda o que os eleitores enxergam.
        </p>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {candidatos?.map((c) => (
          <li key={c.id} className="cartao flex items-center gap-5 p-5">
            <span className="font-mono text-3xl font-bold leading-none">
              {c.numero_urna !== null ? String(c.numero_urna).padStart(2, '0') : '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold">{c.nome_urna}</p>
              <p className="truncate text-sm text-grafite-medio">{c.nome_completo}</p>
              <p className="mt-1 text-sm text-grafite-claro">
                {c.cargo_funcao ?? '—'}{c.setor ? ` · ${c.setor}` : ''}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              c.inscricao_status === 'DEFERIDA' ? 'bg-cipa-claro text-cipa' : 'bg-ambar-claro text-ambar'}`}>
              {c.inscricao_status}
            </span>
          </li>
        ))}
      </ul>

      <FormCandidato eleicaoId={id} />
    </div>
  );
}
