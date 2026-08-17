import type { PayloadApuracao } from './types';

/**
 * Geração das atas a partir de modelo fixo.
 *
 * Ata é documento com efeito jurídico: precisa ser idêntica a cada execução,
 * conferível linha a linha contra os dados do banco e independente de qualquer
 * serviço externo. Por isso nenhum LLM participa daqui.
 */

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function porExtenso(numero: number): string {
  const n = Math.floor(Math.abs(numero));
  if (n === 0) return 'zero';
  if (n === 100) return 'cem';
  if (n < 10) return UNIDADES[n]!;
  if (n < 20) return DEZ_A_DEZENOVE[n - 10]!;

  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]!;
  }

  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto ? `${CENTENAS[c]} e ${porExtenso(resto)}` : CENTENAS[c]!;
  }

  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  const prefixo = milhares === 1 ? 'mil' : `${porExtenso(milhares)} mil`;
  if (!resto) return prefixo;
  const conector = resto < 100 || resto % 100 === 0 ? ' e ' : ' ';
  return `${prefixo}${conector}${porExtenso(resto)}`;
}

function fusoBrasilia(iso: string): Date {
  return new Date(iso);
}

export function dataPorExtenso(iso: string): string {
  const d = fusoBrasilia(iso);
  const dia = d.getDate();
  const ano = d.getFullYear();
  return `aos ${dia} (${porExtenso(dia)}) dias do mês de ${MESES[d.getMonth()]} de ${ano} (${porExtenso(ano)})`;
}

function dataHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Percentual no padrão brasileiro: vírgula decimal. */
function pct(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarCnpj(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function nomeComissao(norma: string): string {
  return norma === 'NR-31'
    ? 'Comissão Interna de Prevenção de Acidentes e de Assédio do Trabalho Rural (CIPATR)'
    : 'Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA)';
}

function siglaComissao(norma: string): string {
  return norma === 'NR-31' ? 'CIPATR' : 'CIPA';
}

/** Bloco de assinaturas, igual nas duas atas. */
function assinaturas(): string {
  return [
    '## Assinaturas',
    '',
    'Nada mais havendo a tratar, lavrou-se a presente ata, que segue assinada pelos membros da comissão eleitoral.',
    '',
    '&nbsp;',
    '',
    '| | |',
    '|---|---|',
    '| \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ | \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ |',
    '| Presidente da comissão eleitoral | Secretário(a) |',
    '| | |',
    '| \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ | \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ |',
    '| Representante do empregador | Responsável técnico — SESMT |',
  ].join('\n');
}

export function montarAtaEleicao(p: PayloadApuracao): string {
  const sigla = siglaComissao(p.eleicao.norma);
  const referencia = p.eleicao.encerrada_em ?? p.eleicao.data_fim;
  const eleitos = p.apuracao.classificacao.filter((c) => c.situacao === 'EFETIVO');
  const suplentes = p.apuracao.classificacao.filter((c) => c.situacao === 'SUPLENTE');
  const empatados = p.apuracao.classificacao.filter((c) => c.empate);
  const rejeitados = p.quarentena.REJEITADO ?? 0;
  const totalVotos = p.apuracao.votos_nominais + p.apuracao.votos_brancos + p.apuracao.votos_nulos;

  const linhas: string[] = [];

  linhas.push(`# Ata de Eleição e Apuração — ${sigla}`);
  linhas.push('');
  linhas.push(`**Empresa:** ${p.empresa.razao_social}`);
  linhas.push(`**CNPJ:** ${formatarCnpj(p.empresa.cnpj)}`);
  if (p.empresa.cnae) linhas.push(`**CNAE:** ${p.empresa.cnae}`);
  if (p.empresa.grau_risco) linhas.push(`**Grau de risco:** ${p.empresa.grau_risco}`);
  linhas.push(`**Gestão:** ${p.eleicao.gestao ?? '—'}`);
  linhas.push(`**Norma aplicável:** ${p.eleicao.norma}`);
  linhas.push('');
  linhas.push('---');
  linhas.push('');

  linhas.push('## 1. Do processo eleitoral');
  linhas.push('');
  linhas.push(
    `${dataPorExtenso(referencia).replace(/^a/, 'A')}, a comissão eleitoral reuniu-se para proceder ` +
    `à apuração dos votos da eleição dos representantes dos empregados na ${nomeComissao(p.eleicao.norma)}, ` +
    `referente à gestão ${p.eleicao.gestao ?? '—'}.`,
  );
  linhas.push('');
  linhas.push(
    `A votação ocorreu de forma eletrônica, secreta e nominal, no período de ${dataHora(p.eleicao.data_inicio)} ` +
    `a ${dataHora(p.eleicao.data_fim)}, por meio de sistema que registra a participação do eleitor em lista ` +
    'de presença própria, sem qualquer vínculo com o voto depositado, assegurando o sigilo previsto na norma.',
  );
  linhas.push('');
  linhas.push(
    'O sistema admitiu duas formas de acesso à urna: credencial individual enviada a cada trabalhador ' +
    'constante da relação fornecida pelo empregador, e autodeclaração mediante leitura de código QR afixado ' +
    'em quadro de avisos, esta última submetida a conferência prévia da comissão eleitoral antes da ' +
    'computação do voto. Em ambos os casos o sistema impediu a duplicidade de voto por CPF.',
  );
  linhas.push('');

  linhas.push('## 2. Do quórum');
  linhas.push('');
  linhas.push(
    `Constaram da relação de eleitores aptos ${p.quorum.aptos} (${porExtenso(p.quorum.aptos)}) trabalhadores, ` +
    `dos quais compareceram à votação ${p.quorum.votantes} (${porExtenso(p.quorum.votantes)}), ` +
    `correspondendo a ${pct(p.quorum.percentual)}% do total de aptos.`,
  );
  linhas.push('');
  linhas.push(
    p.quorum.atingido
      ? '**O quórum mínimo de mais de 50% dos empregados foi atingido**, restando válida a eleição.'
      : '**O quórum mínimo de mais de 50% dos empregados NÃO foi atingido.** A comissão eleitoral deverá ' +
        'deliberar quanto à convocação de nova votação, nos termos da norma aplicável e do edital.',
  );
  linhas.push('');

  linhas.push('## 3. Da apuração');
  linhas.push('');
  linhas.push('| Nº | Candidato | Função | Votos | Situação |');
  linhas.push('|---|---|---|---|---|');
  for (const c of p.apuracao.classificacao) {
    const numero = c.numero_urna !== null ? String(c.numero_urna).padStart(2, '0') : '—';
    const situacao = c.situacao === 'NAO_ELEITO' ? 'Não eleito' : c.situacao === 'EFETIVO' ? 'Eleito — efetivo' : 'Eleito — suplente';
    linhas.push(`| ${numero} | ${c.nome_completo} | ${c.cargo_funcao ?? '—'} | ${c.total_votos} | ${situacao} |`);
  }
  linhas.push('');
  linhas.push(`- Votos nominais: **${p.apuracao.votos_nominais}**`);
  linhas.push(`- Votos em branco: **${p.apuracao.votos_brancos}**`);
  linhas.push(`- Votos nulos: **${p.apuracao.votos_nulos}**`);
  linhas.push(`- Total de votos depositados: **${totalVotos}**`);
  linhas.push('');

  linhas.push('## 4. Do resultado');
  linhas.push('');
  if (eleitos.length) {
    linhas.push(`**Eleitos como representantes titulares (efetivos):**`);
    linhas.push('');
    eleitos.forEach((c, i) => linhas.push(`${i + 1}. ${c.nome_completo} — ${c.cargo_funcao ?? 'função não informada'} — ${c.total_votos} voto(s)`));
    linhas.push('');
  }
  if (suplentes.length) {
    linhas.push(`**Eleitos como suplentes:**`);
    linhas.push('');
    suplentes.forEach((c, i) => linhas.push(`${i + 1}. ${c.nome_completo} — ${c.cargo_funcao ?? 'função não informada'} — ${c.total_votos} voto(s)`));
    linhas.push('');
  }
  if (!eleitos.length && !suplentes.length) {
    linhas.push('Não houve candidatos eleitos nesta apuração.');
    linhas.push('');
  }

  const observacoes: string[] = [];
  if (empatados.length) {
    observacoes.push(
      `**Registro de empate.** Verificou-se empate na votação entre os candidatos: ` +
      `${empatados.map((c) => `${c.nome_completo} (${c.total_votos} voto(s))`).join('; ')}. ` +
      'O desempate compete à comissão eleitoral, conforme critério previsto em edital, ' +
      'devendo ser lavrado termo próprio com a decisão adotada.',
    );
  }
  if (rejeitados > 0) {
    observacoes.push(
      rejeitados === 1
        ? '**Votos não computados.** 1 (uma) manifestação recebida por autodeclaração foi rejeitada ' +
          'pela comissão eleitoral por não conferência dos dados com a relação de empregados, ' +
          'com registro de motivo em log de auditoria do sistema.'
        : `**Votos não computados.** ${rejeitados} (${porExtenso(rejeitados)}) manifestações recebidas ` +
          'por autodeclaração foram rejeitadas pela comissão eleitoral por não conferência dos dados ' +
          'com a relação de empregados, com registro individual de motivo em log de auditoria do sistema.',
    );
  }
  if (observacoes.length) {
    linhas.push('## 5. Das ocorrências');
    linhas.push('');
    observacoes.forEach((o) => { linhas.push(o); linhas.push(''); });
  }

  linhas.push('---');
  linhas.push('');
  linhas.push(assinaturas());
  linhas.push('');
  linhas.push(`_Documento gerado pelo sistema em ${dataHora(new Date().toISOString())}._`);

  return linhas.join('\n');
}

export function montarAtaPosse(p: PayloadApuracao): string {
  const sigla = siglaComissao(p.eleicao.norma);
  const referencia = p.eleicao.encerrada_em ?? p.eleicao.data_fim;
  const eleitos = p.apuracao.classificacao.filter((c) => c.situacao === 'EFETIVO');
  const suplentes = p.apuracao.classificacao.filter((c) => c.situacao === 'SUPLENTE');

  const linhas: string[] = [];

  linhas.push(`# Ata de Instalação e Posse — ${sigla}`);
  linhas.push('');
  linhas.push(`**Empresa:** ${p.empresa.razao_social}`);
  linhas.push(`**CNPJ:** ${formatarCnpj(p.empresa.cnpj)}`);
  linhas.push(`**Gestão:** ${p.eleicao.gestao ?? '—'}`);
  linhas.push('');
  linhas.push('---');
  linhas.push('');

  linhas.push('## 1. Da instalação');
  linhas.push('');
  linhas.push(
    `${dataPorExtenso(referencia).replace(/^a/, 'A')}, reuniram-se os representantes eleitos e indicados ` +
    `para a instalação e posse da ${nomeComissao(p.eleicao.norma)}, gestão ${p.eleicao.gestao ?? '—'}, ` +
    'nos termos da norma regulamentadora aplicável.',
  );
  linhas.push('');

  linhas.push('## 2. Representantes dos empregados (eleitos)');
  linhas.push('');
  linhas.push('| Nome | Função | Condição |');
  linhas.push('|---|---|---|');
  eleitos.forEach((c) => linhas.push(`| ${c.nome_completo} | ${c.cargo_funcao ?? '—'} | Titular |`));
  suplentes.forEach((c) => linhas.push(`| ${c.nome_completo} | ${c.cargo_funcao ?? '—'} | Suplente |`));
  if (!eleitos.length && !suplentes.length) linhas.push('| — | — | — |');
  linhas.push('');

  linhas.push('## 3. Representantes do empregador (indicados)');
  linhas.push('');
  linhas.push('_A ser preenchido pelo empregador, em número paritário ao de representantes eleitos._');
  linhas.push('');
  linhas.push('| Nome | Função | Condição |');
  linhas.push('|---|---|---|');
  const paritarios = Math.max(eleitos.length + suplentes.length, 1);
  for (let i = 0; i < paritarios; i++) linhas.push('| | | |');
  linhas.push('');

  linhas.push('## 4. Da designação');
  linhas.push('');
  linhas.push('- **Presidente** (indicado pelo empregador): \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
  linhas.push('- **Vice-Presidente** (escolhido entre os eleitos): \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
  linhas.push('- **Secretário(a)**: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
  linhas.push('');
  linhas.push('## 5. Do mandato e do calendário');
  linhas.push('');
  linhas.push('- Início da gestão: \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_');
  linhas.push('- Término da gestão: \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_');
  linhas.push('- Data das reuniões ordinárias mensais: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
  linhas.push('');
  linhas.push('---');
  linhas.push('');
  linhas.push(assinaturas());
  linhas.push('');
  linhas.push(`_Documento gerado pelo sistema em ${dataHora(new Date().toISOString())}._`);

  return linhas.join('\n');
}
