import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from '../components/ToastProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vantor Storage',
  description: 'Encrypted file storage and firmware management system for Vantor.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#ffffff',
          colorInputBackground: '#f8fafc',
          colorInputText: '#1e293b',
          colorText: '#1e293b',
          colorTextSecondary: '#64748b',
          fontFamily: "'Ubuntu', 'Inter', system-ui, sans-serif",
        },
        elements: {
          card: 'bg-white border border-gray-200 shadow-2xl',
          headerTitle: '!text-gray-900 font-bold',
          headerSubtitle: '!text-gray-500',
          socialButtonsBlockButton: 'bg-gray-50 border border-gray-200 !text-gray-700 hover:bg-gray-100',
          formFieldLabel: '!text-gray-700 font-medium',
          formFieldInput: 'bg-white border-gray-300 !text-gray-900 placeholder:!text-gray-400 focus:border-blue-500 focus:ring-blue-500',
          footerActionText: '!text-gray-500',
          footerActionLink: '!text-blue-600 hover:!text-blue-700 font-semibold',
          identityPreviewText: '!text-gray-900',
          identityPreviewEditButton: '!text-blue-600',
          formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 !text-white font-semibold',
          userButtonPopoverCard: 'bg-white border border-gray-200 !text-gray-900 shadow-xl',
          userButtonPopoverActionButton: '!text-gray-700 hover:bg-gray-100',
          userButtonPopoverActionButtonText: '!text-gray-700 font-medium',
          userButtonPopoverActionButtonIcon: '!text-gray-700',
          userButtonPopoverFooter: 'hidden',
          userPreviewTextContainer: '!text-gray-900',
          userPreviewMainIdentifier: '!text-gray-900 font-semibold',
          userPreviewSecondaryIdentifier: '!text-gray-500',
        },
      }}
    >
      <html lang="en" className="dark">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link
            href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="min-h-screen bg-[#060a17] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
          <ToastProvider>
            {children}
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
