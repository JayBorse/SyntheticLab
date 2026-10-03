import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SyntheticLab — Autonomous Synthetic Buyer & Churn Simulation Arena | Nebius x NVIDIA',
  description:
    'Autonomous synthetic buyer swarm powered by NVIDIA Nemotron (Ultra 550B & Super 120B) on Nebius Token Factory and Tavily AI Search. Stress-tests pricing, packaging, and objection models against living decision-maker swarms with anti-circular hold-out validation.',
  keywords: [
    'Nebius Token Factory',
    'NVIDIA Nemotron',
    'Synthetic Buyers',
    'Tavily Search',
    'Autonomous Agent',
    'Churn Simulation',
    'SyntheticLab',
    'AI Hackathon 2026',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent)] selection:text-white">
        {children}
      </body>
    </html>
  );
}
