import './globals.css';
import type { Metadata } from 'next';
import {
  GoogleTagManagerNoScript,
  GoogleTagManagerScript
} from './analytics/GoogleTagManager';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { getServerLocale } from './i18n/serverLocale';

export function generateMetadata(): Metadata {
  const locale = getServerLocale();
  return locale === 'en'
    ? {
        title: 'The Big Tree BJJ — Jiu-jitsu history and lineage',
        description:
          'A historical archive and jiu-jitsu lineage tree, with evidence-graded links, sources and open research gaps.'
      }
    : {
        title: 'The Big Tree BJJ — História e linhagem do jiu-jitsu',
        description:
          'Arquivo histórico e árvore genealógica do jiu-jitsu, com vínculos graduados por evidência, fontes e lacunas de pesquisa.'
      };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getServerLocale();
  return (
    <html lang={locale === 'en' ? 'en' : 'pt-BR'}>
      <head>
        <GoogleTagManagerScript />
      </head>
      <body>
        <GoogleTagManagerNoScript />
        {children}
        <LanguageSwitcher locale={locale} />
      </body>
    </html>
  );
}
