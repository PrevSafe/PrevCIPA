import QRCode from 'qrcode';
import { BotaoImprimir } from '@/components/ui/BotaoImprimir';
import { supabaseServidor } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Cartaz A4 para o mural: quem não tem e-mail nem telefone entra por aqui. */
export default async function Cartaz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServidor();

  const { data: eleicao } = await supabase
    .from('eleicoes')
    .select('titulo, tipo, gestao, data_inicio, data_fim, empresas_clientes(razao_social)')
    .eq('id', id)
    .single();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const url = `${base}/q/${id}`;
  const qr = await QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: 'H' });
  const empresa = (eleicao?.empresas_clientes as unknown as { razao_social: string } | null)?.razao_social ?? '';

  return (
    <div>
      <p className="nao-imprimir rotulo">Mural</p>
      <div className="nao-imprimir mt-2 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl font-extrabold">Cartaz para impressão</h1>
        <BotaoImprimir />
      </div>
      <p className="nao-imprimir mt-2 max-w-2xl text-grafite-medio">
        Imprima e afixe no refeitório, no ponto e no vestiário. Quem votar por aqui cai na fila
        de conferência.
      </p>

      <div className="cartao mx-auto mt-8 max-w-[210mm] p-12 text-center">
        <p className="rotulo">{empresa}</p>
        <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.95]">
          Vote na sua<br />CIPA
        </h2>
        <p className="mt-4 text-xl text-grafite-medio">
          {eleicao?.titulo} · gestão {eleicao?.gestao ?? '—'}
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR Code para votar: ${url}`} className="mx-auto mt-10 h-72 w-72" />

        <p className="mt-8 font-display text-2xl font-bold">Aponte a câmera do celular</p>
        <p className="mt-2 text-lg text-grafite-medio">
          Leva menos de um minuto. Você informa seu CPF só para provar que votou —
          seu voto continua secreto.
        </p>

        <p className="mt-10 font-mono text-sm text-grafite-claro">{url}</p>
        <p className="mt-2 text-sm text-grafite-claro">
          Votação de {eleicao && new Date(eleicao.data_inicio).toLocaleDateString('pt-BR')} a{' '}
          {eleicao && new Date(eleicao.data_fim).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
