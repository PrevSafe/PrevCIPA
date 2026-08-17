import type { Config } from 'tailwindcss';

/**
 * Paleta derivada da sinalização de segurança do trabalho (ABNT NBR 7195):
 * verde = segurança/CIPA, âmbar = atenção, vermelho = impedimento.
 * O fundo é concreto, não branco: o app é lido no chão de fábrica, no sol.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        concreto: { DEFAULT: '#EDEEEC', escuro: '#DCDEDA' },
        grafite: { DEFAULT: '#14201A', medio: '#4A554E', claro: '#7B857F' },
        cipa: { DEFAULT: '#0B6E4F', escuro: '#08523A', claro: '#E6F2ED' },
        ambar: { DEFAULT: '#E8A317', claro: '#FDF3DC' },
        alerta: { DEFAULT: '#C1272D', claro: '#FBE9E9' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        cartao: '0 1px 0 0 rgba(20,32,26,0.08), 0 6px 18px -12px rgba(20,32,26,0.35)',
        urna: '0 -12px 40px -12px rgba(20,32,26,0.45)',
      },
      keyframes: {
        subir: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        entrar: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        subir: 'subir .22s cubic-bezier(.2,.8,.2,1)',
        entrar: 'entrar .3s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
