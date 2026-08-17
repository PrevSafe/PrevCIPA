import { supabaseServidor } from '@/lib/supabase/server';
import { ImportadorCsv } from '@/components/painel/ImportadorCsv';
import { GeradorLinks } from '@/components/painel/GeradorLinks';

export const dynamic = 'force-dynamic';

export default async function Eleitores({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const { data: eleitores, count } = await supabase
    .from('eleitores')
    .select('id, nome, cpf, cargo_funcao, setor, contato_email, contato_telefone, token_hash, status_voto', { count: 'exact' })
    .eq('eleicao_id', id)
    .order('nome')
    .limit(200);

  const comLink = eleitores?.filter((e) => e.token_hash).length ?? 0;
  const votaram = eleitores?.filter((e) => e.status_voto).length ?? 0;

  return (
    <div>
      <p className="rotulo">Lista do RH</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Eleitores aptos</h1>
      <p className="mt-2 text-grafite-medio">
        {count ?? 0} na lista · {comLink} com link gerado · {votaram} já votaram
      </p>

      <ImportadorCsv eleicaoId={id} />
      <GeradorLinks eleicaoId={id} />

      <div className="cartao mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-concreto">
            <tr className="text-left">
              {['Nome', 'CPF', 'Função', 'Contato', 'Situação'].map((h) => (
                <th key={h} className="px-5 py-3 font-display text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eleitores?.map((e) => (
              <tr key={e.id} className="border-t border-concreto-escuro">
                <td className="px-5 py-3 font-medium">{e.nome}</td>
                <td className="px-5 py-3 font-mono text-grafite-medio">
                  {`***.${String(e.cpf).slice(3, 6)}.${String(e.cpf).slice(6, 9)}-**`}
                </td>
                <td className="px-5 py-3 text-grafite-medio">{e.cargo_funcao ?? '—'}</td>
                <td className="px-5 py-3 text-grafite-medio">
                  {e.contato_email ?? e.contato_telefone ?? <span className="text-ambar">sem contato · usa o mural</span>}
                </td>
                <td className="px-5 py-3">
                  {e.status_voto
                    ? <span className="rounded-full bg-cipa-claro px-3 py-1 text-xs font-semibold text-cipa">Votou</span>
                    : <span className="rounded-full bg-concreto px-3 py-1 text-xs font-semibold text-grafite-medio">Aguardando</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(count ?? 0) > 200 && (
        <p className="mt-4 text-sm text-grafite-claro">Mostrando os 200 primeiros nomes.</p>
      )}
    </div>
  );
}
