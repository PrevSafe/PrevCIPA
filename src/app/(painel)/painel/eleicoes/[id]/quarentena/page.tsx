import { supabaseServidor } from '@/lib/supabase/server';
import { FilaQuarentena } from '@/components/painel/FilaQuarentena';
import type { EnvelopeQuarentena } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Quarentena({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const { data } = await supabase.rpc('fila_quarentena', {
    p_eleicao_id: id,
    p_status: 'PENDENTE',
  });

  return (
    <div>
      <p className="rotulo">Conferência</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Votos do mural em quarentena</h1>
      <p className="mt-2 max-w-2xl text-grafite-medio">
        Cada envelope traz a identidade declarada no QR Code cruzada com a lista do RH.
        Ao aprovar, o voto é computado e o vínculo com a pessoa é apagado na mesma transação.
      </p>

      <FilaQuarentena eleicaoId={id} envelopes={(data ?? []) as EnvelopeQuarentena[]} />
    </div>
  );
}
