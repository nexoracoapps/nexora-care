'use client';

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { BranchProvider } from '@/context/BranchContext';
import { LanguageProvider } from '@/context/LanguageContext';
import MusicPlayer from '@/components/MusicPlayer';
import IdleTimeout from '@/components/IdleTimeout';
import { MusicProvider } from '@/context/MusicContext';
import { PermissionsProvider } from '@/context/PermissionsContext';

export default function Providers({ children, initialLang }: { children: React.ReactNode; initialLang?: string }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider initialLang={initialLang}>
          <BranchProvider>
            <PermissionsProvider>
            <MusicProvider>
            {children}
            <MusicPlayer />
            <IdleTimeout />
            </MusicProvider>
            </PermissionsProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontFamily: 'var(--font)',
                  fontSize: '0.9rem',
                },
                success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
                error: { iconTheme: { primary: '#e53e5a', secondary: 'white' } },
              }}
            />
          </BranchProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
