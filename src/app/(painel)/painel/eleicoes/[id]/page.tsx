import Link from 'next/link';
import { supabaseServidor } from '@/lib/supabase/server';
import { PainelAcoes } from '@/components/painel/PainelAcoes';
import type { Painel } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Indicador({ rotulo, valor, detalhe, destaque }: {
  rotulo: string; valor: string; detalhe?: string; destaque?: 'ok' | 'atencao';
}) {
  const cor = destaque === 'ok' ? 'text-cipa' : destaque === 'atencao' ? 'text-ambar' : '';
  return (
    <div className="cartao p-5">
      <p className="rotulo">{rotulo}</p>
      <p className={`mt-2 font-mono text-4xl font-bold leading-none ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-2 text-sm text-grafite-medio">{detalhe}</p>}
    </div>
  );
}

export default async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const [{ data: eleicao }, { data: painelBruto }] = await Promise.all([
    supabase.from('eleicoes')
      .select('id, titulo, tipo, gestao, status, data_inicio, data_fim, vagas_efetivos, vagas_suplentes, empresas_clientes(razao_social)')
      .eq('id', id).single(),
    supabase.rpc('painel_eleicao', { p_eleicao_id: id }),
  ]);

  if (!eleicao) {
    return <p className="text-grafite-medio">Eleição não encontrada ou fora do seu acesso.</p>;
  }

  const painel = painelBruto as Painel;
  const empresa = (eleicao.empresas_clientes as unknown as { razao_social: string } | null)?.razao_social ?? '—';

  const abas = [
    { href: `/painel/eleicoes/${id}/eleitores`, texto: 'Lista do RH' },
    { href: `/painel/eleicoes/${id}/candidatos`, texto: 'Candidatos' },
    { href: `/painel/eleicoes/${id}/quarentena`, texto: `Quarentena${painel?.quarentena_pendente ? ` (${painel.quarentena_pendente})` : ''}` },
    { href: `/painel/eleicoes/${id}/cartaz`, texto: 'Cartaz do mural' },
    { href: `/painel/eleicoes/${id}/apuracao`, texto: 'Apuração e atas' },
  ];

  return (
    <div>
      <p className="rotulo">{empresa} · {eleicao.tipo} · gestão {eleicao.gestao ?? '—'}</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">{eleicao.titulo}</h1>
      <p className="mt-2 text-grafite-medio">
        {new Date(eleicao.data_inicio).toLocaleString('pt-BR')} até {new Date(eleicao.data_fim).toLocaleString('pt-BR')}
        {' · '}{eleicao.vagas_efetivos} efetivo(s) e {eleicao.vagas_suplentes} suplente(s)
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {abas.map((a) => (
          <Link key={a.href} href={a.href} className="botao-secundario h-11 px-4 text-xs">
            {a.texto}
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Quórum"
          valor={`${painel?.quorum_percent ?? 0}%`}
          detalhe={`${painel?.votantes ?? 0} de ${painel?.aptos ?? 0} aptos`}
          destaque={painel?.quorum_atingido ? 'ok' : 'atencao'}
        />
        <Indicador rotulo="Pela lista do RH" valor={String(painel?.por_origem?.LINK_MAGICO ?? 0)} detalhe="Link mágico" />
        <Indicador rotulo="Pelo mural" valor={String(painel?.por_origem?.QR_CODE ?? 0)} detalhe="QR Code aprovado" />
        <Indicador
          rotulo="Aguardando conferência"
          valor={String(painel?.quarentena_pendente ?? 0)}
          detalhe="Precisa zerar para encerrar"
          destaque={painel?.quarentena_pendente ? 'atencao' : 'ok'}
        />
      </div>

      <div className="cartao mt-6 p-6">
        <p className="rotulo">Situação</p>
        <p className="mt-2 font-display text-2xl font-bold">{eleicao.status}</p>
        <p className="mt-2 max-w-2xl text-grafite-medio">
          {painel?.resultado_disponivel
            ? 'A apuração está liberada. Gere as atas na aba Apuração.'
            : 'A contagem de votos fica oculta enquanto a urna estiver aberta — inclusive para a comissão.'}
        </p>
        <PainelAcoes eleicaoId={id} status={eleicao.status} />
      </div>
    </div>
  );
}
