/**
 * Conversor mínimo de Markdown para HTML, suficiente para o formato das atas
 * (títulos, listas, tabelas, negrito e regras). Escapa o texto antes de tudo:
 * o conteúdo vem de um LLM e não é confiável por definição.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(texto: string): string {
  return escapar(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function markdownParaHtml(markdown: string): string {
  const saida: string[] = [];
  let emLista = false;
  let emTabela = false;

  const fechar = () => {
    if (emLista) { saida.push('</ul>'); emLista = false; }
    if (emTabela) { saida.push('</tbody></table>'); emTabela = false; }
  };

  for (const linha of markdown.split('\n')) {
    const l = linha.trimEnd();

    if (!l.trim()) { fechar(); continue; }

    const titulo = l.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) {
      fechar();
      const nivel = titulo[1]!.length;
      saida.push(`<h${nivel}>${inline(titulo[2]!)}</h${nivel}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(l.trim())) { fechar(); saida.push('<hr />'); continue; }

    if (/^\s*[-*]\s+/.test(l)) {
      if (emTabela) fechar();
      if (!emLista) { saida.push('<ul>'); emLista = true; }
      saida.push(`<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (l.trim().startsWith('|')) {
      const celulas = l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (celulas.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!emTabela) {
        saida.push('<table><thead><tr>' + celulas.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
        emTabela = true;
        continue;
      }
      saida.push('<tr>' + celulas.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      continue;
    }

    fechar();
    saida.push(`<p>${inline(l)}</p>`);
  }

  fechar();
  return saida.join('\n');
}
