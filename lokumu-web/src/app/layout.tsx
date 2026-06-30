import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Lokumu — Assistant culturel',
  description:
    'Assistant culturel congolais en francais, anglais, lingala et kituba.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#212121] text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
