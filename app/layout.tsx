import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Nexora Care',
  description: 'Complete clinic & wellness management platform',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexora Care',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const savedLang = cookieStore.get('lang')?.value;
  const initialLang = savedLang === 'ar' ? 'ar' : 'en';

  return (
    <html lang={initialLang} dir={initialLang === 'ar' ? 'rtl' : 'ltr'} data-theme="nexora" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body suppressHydrationWarning>
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
