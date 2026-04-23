import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Daily Digest',
  description: 'Your personal AI-curated news dashboard',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-jade" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
