'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServidor } from '@/lib/supabase/server';
import { mensagemDoErro } from '@/lib/erros';
import type { EleitorComToken } from '@/lib/types';

export type Resultado = { ok: boolean; mensagem: string };

function atualizar(eleicaoId: string) {
  revalidatePath(`/painel/eleicoes/${eleicaoId}`, 'layout');
}

export async function abrirEleicao(eleicaoId: string): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc('abrir_eleicao', { p_eleicao_id: eleicaoId });
  atualizar(eleicaoId);
  return error
    ? { ok: false, mensagem: mensagemDoErro(error) }
    : { ok: true, mensagem: 'Votação aberta. Os links e o QR Code já funcionam.' };
}

export async function aprovarEnvelope(eleicaoId: string, envelopeId: string): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc('aprovar_voto_quarentena', { p_quarentena_id: envelopeId });
  atualizar(eleicaoId);
  return error
    ? { ok: false, mensagem: mensagemDoErro(error) }
    : { ok: true, mensagem: 'Voto computado e desvinculado do eleitor.' };
}

export async function rejeitarEnvelope(
  eleicaoId: string, envelopeId: string, motivo: string,
): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc('rejeitar_voto_quarentena', {
    p_quarentena_id: envelopeId,
    p_motivo: motivo,
  });
  atualizar(eleicaoId);
  return error
    ? { ok: false, mensagem: mensagemDoErro(error) }
    : { ok: true, mensagem: 'Voto rejeitado e registrado no log de auditoria.' };
}

export async function aprovarLote(eleicaoId: string, ids: string[]): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.rpc('aprovar_quarentena_lote', { p_ids: ids });
  atualizar(eleicaoId);
  if (error) return { ok: false, mensagem: mensagemDoErro(error) };
  const resumo = data as { aprovados: number; erros: unknown[] };
  return {
    ok: true,
    mensagem: `${resumo.aprovados} voto(s) computado(s)` +
      (resumo.erros?.length ? `, ${resumo.erros.length} com erro.` : '.'),
  };
}

export type LinhaEleitor = {
  nome: string; cpf: string; cargo_funcao?: string; setor?: string;
  matricula?: string; contato_email?: string; contato_telefone?: string;
};

export async function importarEleitores(
  eleicaoId: string, linhas: LinhaEleitor[],
): Promise<Resultado & { ignorados?: number }> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.rpc('importar_eleitores', {
    p_eleicao_id: eleicaoId,
    p_eleitores: linhas,
  });
  atualizar(eleicaoId);
  if (error) return { ok: false, mensagem: mensagemDoErro(error) };

  const resumo = data as { processados: number; ignorados: unknown[]; total_aptos: number };
  return {
    ok: true,
    ignorados: resumo.ignorados?.length ?? 0,
    mensagem: `${resumo.processados} eleitor(es) na lista. Total de aptos: ${resumo.total_aptos}.` +
      (resumo.ignorados?.length ? ` ${resumo.ignorados.length} linha(s) ignorada(s) por CPF ou nome inválido.` : ''),
  };
}

/** Devolve os tokens em claro uma única vez, para o disparo. */
export async function gerarTokens(eleicaoId: string): Promise<Resultado & { links?: string[] }> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.rpc('gerar_tokens_eleicao', {
    p_eleicao_id: eleicaoId,
    p_validade_horas: 168,
    p_apenas_sem_token: true,
  });
  if (error) return { ok: false, mensagem: mensagemDoErro(error) };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const eleitores = (data ?? []) as EleitorComToken[];
  const links = eleitores.map(
    (e) => `${e.nome};${e.contato_email ?? e.contato_telefone ?? ''};${base}/v/${e.token}`,
  );
  atualizar(eleicaoId);
  return { ok: true, links, mensagem: `${links.length} link(s) gerado(s).` };
}

export async function criarCandidato(eleicaoId: string, dados: FormData): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const numero = dados.get('numero_urna')?.toString();
  const { error } = await supabase.from('candidatos').insert({
    eleicao_id: eleicaoId,
    nome_completo: dados.get('nome_completo')?.toString(),
    nome_urna: dados.get('nome_urna')?.toString(),
    cargo_funcao: dados.get('cargo_funcao')?.toString() || null,
    setor: dados.get('setor')?.toString() || null,
    numero_urna: numero ? Number(numero) : null,
  });
  atualizar(eleicaoId);
  return error
    ? { ok: false, mensagem: 'Não foi possível cadastrar. Confira se o número da urna já existe.' }
    : { ok: true, mensagem: 'Candidato cadastrado.' };
}
