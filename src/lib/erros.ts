/**
 * As RPCs levantam códigos secos (JA_VOTOU, TOKEN_EXPIRADO...). Aqui eles viram
 * frases que um operador de máquina entende sem chamar o SESMT.
 */
const MENSAGENS: Record<string, string> = {
  TOKEN_INVALIDO: 'Este link não é válido. Peça um novo link ao SESMT.',
  TOKEN_EXPIRADO: 'Este link expirou. Peça um novo link ao SESMT.',
  JA_VOTOU: 'Este CPF já votou nesta eleição.',
  VOTO_EM_ANALISE: 'Seu voto já foi enviado e está aguardando conferência da comissão.',
  ELEICAO_NAO_ABERTA: 'A votação ainda não foi liberada.',
  ELEICAO_NAO_INICIADA: 'A votação ainda não começou.',
  ELEICAO_ENCERRADA: 'A votação já foi encerrada.',
  ELEICAO_NAO_ENCONTRADA: 'Eleição não encontrada.',
  CPF_INVALIDO: 'CPF inválido. Confira os números.',
  NOME_INVALIDO: 'Escreva seu nome completo.',
  CANDIDATO_INVALIDO: 'Candidato indisponível. Atualize a página.',
  CANDIDATO_OBRIGATORIO: 'Escolha um candidato para continuar.',
  BRANCO_NAO_PERMITIDO: 'Voto em branco não é aceito nesta eleição.',
  NULO_NAO_PERMITIDO: 'Voto nulo não é aceito nesta eleição.',
  QR_CODE_DESABILITADO: 'A votação por QR Code está desativada nesta eleição.',
  ACESSO_NEGADO: 'Você não tem permissão para esta ação.',
  QUARENTENA_PENDENTE: 'Analise todos os votos em quarentena antes de encerrar.',
  SEM_CANDIDATOS_DEFERIDOS: 'Cadastre ao menos um candidato deferido antes de abrir.',
  SEM_ELEITORES_IMPORTADOS: 'Importe a lista do RH antes de abrir a votação.',
  CPF_JA_ASSINOU: 'Este CPF já consta na lista de presença.',
  VOTO_JA_PROCESSADO: 'Este envelope já foi analisado.',
  MOTIVO_OBRIGATORIO: 'Descreva o motivo da rejeição.',
  STATUS_INVALIDO: 'A eleição não está no estado necessário para esta ação.',
  ELEICAO_NAO_EDITAVEL: 'Esta eleição não aceita mais alterações.',
};

export function codigoDoErro(erro: unknown): string {
  const bruto =
    typeof erro === 'string'
      ? erro
      : (erro as { message?: string })?.message ?? '';
  const achado = bruto.match(/[A-Z][A-Z0-9_]{3,}/);
  return achado ? achado[0] : 'ERRO_DESCONHECIDO';
}

export function mensagemDoErro(erro: unknown): string {
  const codigo = codigoDoErro(erro);
  return MENSAGENS[codigo] ?? 'Não foi possível concluir. Tente novamente em instantes.';
}
