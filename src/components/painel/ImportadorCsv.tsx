'use client';
import { useRef, useState, useTransition } from 'react';
import Papa from 'papaparse';
import { importarEleitores, type LinhaEleitor } from '@/app/(painel)/painel/eleicoes/[id]/actions';
import { Aviso } from './Aviso';

/** Aceita cabeçalhos em português com ou sem acento, em qualquer ordem. */
const SINONIMOS: Record<string, keyof LinhaEleitor> = {
  nome: 'nome', 'nome completo': 'nome', funcionario: 'nome', colaborador: 'nome',
  cpf: 'cpf',
  cargo: 'cargo_funcao', funcao: 'cargo_funcao', 'cargo/funcao': 'cargo_funcao', cargo_funcao: 'cargo_funcao',
  setor: 'setor', departamento: 'setor',
  matricula: 'matricula',
  email: 'contato_email', 'e-mail': 'contato_email',
  telefone: 'contato_telefone', celular: 'contato_telefone', whatsapp: 'contato_telefone', contato: 'contato_telefone',
};

function normalizar(cabecalho: string): string {
  return cabecalho.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function ImportadorCsv({ eleicaoId }: { eleicaoId: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<LinhaEleitor[]>([]);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function lerArquivo(arquivo: File) {
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => SINONIMOS[normalizar(h)] ?? normalizar(h),
      complete: (resultado) => {
        const linhas = resultado.data
          .map((l) => ({
            nome: l.nome ?? '',
            cpf: l.cpf ?? '',
            cargo_funcao: l.cargo_funcao,
            setor: l.setor,
            matricula: l.matricula,
            contato_email: l.contato_email,
            contato_telefone: l.contato_telefone,
          }))
          .filter((l) => l.nome && l.cpf);

        setPrevia(linhas);
        setAviso(
          linhas.length
            ? { tom: 'ok', texto: `${linhas.length} linha(s) lida(s). Confira e envie.` }
            : { tom: 'erro', texto: 'Nenhuma linha com nome e CPF. Confira os cabeçalhos do arquivo.' },
        );
      },
    });
  }

  return (
    <div className="cartao mt-8 p-6">
      <p className="rotulo">Importar lista do RH</p>
      <h2 className="mt-2 font-display text-xl font-bold">Envie o CSV</h2>
      <p className="mt-2 max-w-2xl text-grafite-medio">
        Colunas aceitas: nome, cpf, cargo, setor, matrícula, e-mail, telefone. Reimportar o mesmo
        arquivo atualiza os dados de quem ainda não votou — nunca duplica.
      </p>

      <input
        ref={entrada}
        type="file"
        accept=".csv,text/csv"
        className="mt-5 block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-grafite file:px-5 file:py-3 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-wider file:text-white"
        onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])}
      />

      {aviso && <Aviso tom={aviso.tom} texto={aviso.texto} />}

      {previa.length > 0 && (
        <>
          <div className="mt-5 max-h-64 overflow-auto rounded-xl border border-concreto-escuro">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-concreto">
                <tr className="text-left">
                  <th className="px-4 py-2 font-display text-xs uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-2 font-display text-xs uppercase tracking-wider">CPF</th>
                  <th className="px-4 py-2 font-display text-xs uppercase tracking-wider">Função</th>
                </tr>
              </thead>
              <tbody>
                {previa.slice(0, 50).map((l, i) => (
                  <tr key={i} className="border-t border-concreto-escuro">
                    <td className="px-4 py-2">{l.nome}</td>
                    <td className="px-4 py-2 font-mono">{l.cpf}</td>
                    <td className="px-4 py-2 text-grafite-medio">{l.cargo_funcao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="botao-primario mt-5 h-12"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await importarEleitores(eleicaoId, previa);
                setAviso({ tom: r.ok ? 'ok' : 'erro', texto: r.mensagem });
                if (r.ok) { setPrevia([]); if (entrada.current) entrada.current.value = ''; }
              })
            }
          >
            {pendente ? 'Enviando…' : `Importar ${previa.length} eleitor(es)`}
          </button>
        </>
      )}
    </div>
  );
}
