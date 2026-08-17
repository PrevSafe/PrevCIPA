import { supabaseServidor } from '@/lib/supabase/server';
import { GeradorAta } from '@/components/painel/GeradorAta';

export const dynamic = 'force-dynamic';

export default async function Apuracao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const { data: eleicao } = await supabase
    .from('eleicoes')
    .select('titulo, status, ata_eleicao_md')
    .eq('id', id)
    .single();

  return (
    <div>
      <p className="nao-imprimir rotulo">Apuração</p>
      <h1 className="nao-imprimir mt-2 font-display text-3xl font-extrabold">
        Encerramento e atas
      </h1>
      <p className="nao-imprimir mt-2 max-w-2xl text-grafite-medio">
        Encerrar exige quarentena zerada. A partir daí o sistema consolida quórum, votos por
        candidato, brancos e nulos, e pede a redação da ata ao Gemini.
        {eleicao?.status === 'ABERTA' && ' A urna ainda está aberta — encerrar é irreversível.'}
      </p>

      <GeradorAta eleicaoId={id} ataSalva={eleicao?.ata_eleicao_md ?? null} />
    </div>
  );
}
