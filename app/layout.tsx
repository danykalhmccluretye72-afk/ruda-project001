import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AppNav } from '@/components/app-nav'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Рудный склад — учёт остатков',
  description: 'Учёт остатков руды по штабелям рудного склада золотоизвлекательной фабрики',
}

export const viewport: Viewport = {
  themeColor: '#1c1a17',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col md:flex-row">
          <AppNav />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
