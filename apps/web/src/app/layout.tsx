import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Big Tree BJJ',
  description: 'The Global Jiu-Jitsu Lineage Database'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
