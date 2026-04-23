import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import AuthProvider from './components/AuthProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora' })

export const metadata: Metadata = {
  title: 'RapidFire',
  description: 'Your personal AI-curated news dashboard',
  icons: {
    icon: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-jade font-inter" suppressHydrationWarning>
      <body className={`${inter.variable} ${lora.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
