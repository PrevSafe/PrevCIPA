import { supabaseAnonimo } from '@/lib/supabase/anon';
import { FluxoQrCode } from '@/components/eleitor/FluxoQrCode';
import { TelaAviso } from '@/components/eleitor/TelaAviso';
import { mensagemDoErro } from '@/lib/erros';
import type { Cedula } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PaginaQrCode({
  params,
}: {
  params: Promise<{ eleicaoId: string }>;
}) {
  const { eleicaoId } = await params;
  const supabase = supabaseAnonimo();

  const { data, error } = await supabase.rpc('obter_cedula', { p_eleicao_id: eleicaoId });

  if (error || !data) {
    return <TelaAviso tom="erro" titulo="Eleição não encontrada" descricao={mensagemDoErro(error)} />;
  }

  const cedula = data as Cedula;

  if (!cedula.eleicao.permite_qr_code) {
    return (
      <TelaAviso
        tom="atencao"
        titulo="Votação por QR Code desativada"
        descricao="Nesta eleição o voto é feito apenas pelo link enviado a cada trabalhador."
      />
    );
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
            : `A urna abre em ${new Date(cedula.eleicao.data_inicio).toLocaleString('pt-BR')}.`
        }
      />
    );
  }

  return <FluxoQrCode cedula={cedula} />;
}
