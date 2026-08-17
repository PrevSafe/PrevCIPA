import type { PayloadApuracao } from './types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function promptAtaEleicao(payload: PayloadApuracao): string {
  return [
    'Você é Engenheiro de Segurança do Trabalho e está redigindo um documento oficial.',
    `Gere a ATA DE ELEIÇÃO E APURAÇÃO da ${payload.eleicao.norma === 'NR-31' ? 'CIPATR (NR-31)' : 'CIPA (NR-05)'}`,
    'com base exclusivamente nos dados abaixo. Regras:',
    '- Português do Brasil, registro formal, sem adjetivos de marketing.',
    '- Não invente nomes, datas, horários ou números que não estejam no JSON.',
    '- Estruture: cabeçalho da empresa, período e forma da votação (eletrônica, sigilosa),',
    '  quórum apurado, quadro de apuração por candidato, relação de eleitos (efetivos e suplentes),',
    '  registro dos votos brancos e nulos, e campo de assinaturas da comissão eleitoral.',
    '- Se algum candidato estiver marcado com "empate": true, registre o empate de forma explícita',
    '  e indique que o desempate cabe à comissão eleitoral conforme critério previsto em edital.',
    '- Se o quórum não foi atingido, registre o fato e a necessidade de deliberação da comissão.',
    '- Retorne SOMENTE Markdown, sem cercas de código e sem comentários seus.',
    '',
    'DADOS:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

export function promptAtaPosse(payload: PayloadApuracao): string {
  return [
    'Você é Engenheiro de Segurança do Trabalho.',
    `Gere a ATA DE INSTALAÇÃO E POSSE da ${payload.eleicao.norma === 'NR-31' ? 'CIPATR' : 'CIPA'}`,
    'gestão ' + (payload.eleicao.gestao ?? 'vigente') + ', com base nos dados abaixo.',
    'Inclua: composição dos representantes eleitos dos empregados (efetivos e suplentes),',
    'espaço para os representantes indicados pelo empregador, designação de Presidente e Vice-Presidente,',
    'e campo de assinaturas. Não invente dados. Retorne SOMENTE Markdown.',
    '',
    'DADOS:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

export async function gerarAta(prompt: string): Promise<string> {
  const chave = process.env.GOOGLE_AI_API_KEY;
  if (!chave) throw new Error('GOOGLE_AI_API_KEY não configurada');
  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const resposta = await fetch(`${ENDPOINT}/${modelo}:generateContent?key=${chave}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Google AI respondeu ${resposta.status}: ${await resposta.text()}`);
  }

  const dados = await resposta.json();
  const texto = dados?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();

  if (!texto) throw new Error('Google AI devolveu resposta vazia');
  return texto.replace(/^```(?:markdown)?\n?/i, '').replace(/```$/i, '').trim();
}
