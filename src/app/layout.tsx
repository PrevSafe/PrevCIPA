import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Archivo({
  subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display',
});
const corpo = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans',
});
const numeros = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'CIPA Digital',
  description: 'Eleição de CIPA e CIPATR 100% digital, com sigilo do voto e lista de presença válida.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'CIPA Digital' },
};

export const viewport: Viewport = {
  themeColor: '#0B6E4F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${numeros.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
