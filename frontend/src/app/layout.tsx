import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Account Forecaster',
  description: 'Forecast your account balance based on recurring transactions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
