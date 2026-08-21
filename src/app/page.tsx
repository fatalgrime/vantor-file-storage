'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
      <div className="text-center">
        <div className="flex flex-col items-center justify-center space-y-3 mb-6 select-none">
          <img
            src="/logo.png"
            alt="Vantor logo"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="h-12 w-auto object-contain select-none pointer-events-auto"
          />
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">Storage</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">Sign in to your repository dashboard.</p>
        <button
          onClick={() => router.push('/sign-in')}
          className="mt-5 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-md cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
