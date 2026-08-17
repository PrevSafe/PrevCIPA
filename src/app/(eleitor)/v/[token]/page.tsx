import { supabaseAnonimo } from '@/lib/supabase/anon';
import { Urna } from '@/components/eleitor/Urna';
import { Comprovante } from '@/components/eleitor/Comprovante';
import { TelaAviso } from '@/components/eleitor/TelaAviso';
import { mensagemDoErro } from '@/lib/erros';
import type { Cedula, SessaoEleitor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PaginaLinkMagico({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = supabaseAnonimo();

  const { data: sessao, error: erroSessao } = await supabase.rpc('validar_token_magico', {
    p_token: token,
  });

  if (erroSessao || !sessao) {
    return <TelaAviso tom="erro" titulo="Link não reconhecido" descricao={mensagemDoErro(erroSessao)} />;
  }

  const eleitor = sessao as SessaoEleitor;

  const { data: cedulaBruta, error: erroCedula } = await supabase.rpc('obter_cedula', {
    p_eleicao_id: eleitor.eleicao_id,
  });

  if (erroCedula || !cedulaBruta) {
    return <TelaAviso tom="erro" titulo="Eleição indisponível" descricao={mensagemDoErro(erroCedula)} />;
  }

  const cedula = cedulaBruta as Cedula;
  const empresa = cedula.empresa.nome_fantasia || cedula.empresa.razao_social;

  if (eleitor.ja_votou) {
    return <Comprovante nomeEmpresa={empresa} titulo={cedula.eleicao.titulo} />;
  }

  if (!cedula.eleicao.aceitando_votos) {
    const encerrada = new Date(cedula.eleicao.data_fim) < new Date();
    return (
      <TelaAviso
        tom="atencao"
        titulo={encerrada ? 'Votação encerrada' : 'Votação ainda não começou'}
        descricao={
          encerrada
            ? 'O período de votação terminou. O resultado será divulgado pela comissão eleitoral.'
            : `A urna abre em ${new Date(cedula.eleicao.data_inicio).toLocaleString('pt-BR')}. Guarde este link.`
        }
      />
    );
  }

  return (
    <Urna
      cedula={cedula}
      saudacao={eleitor.nome}
      identificacao={{ origem: 'LINK_MAGICO', token }}
    />
  );
}
