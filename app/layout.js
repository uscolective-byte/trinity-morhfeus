import './globals.css';

export const metadata = {
  title: 'TRINITY // OMNI-CORE 11.1 - Sovereign Multi-Agent Console',
  description: 'Sovereign Multi-Agent Operating Center & Autonomous Control Surface for Basterix (Sabo Ivan)',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <head>
        <meta name="theme-color" content="#05070c" />
      </head>
      <body>{children}</body>
    </html>
  );
}
