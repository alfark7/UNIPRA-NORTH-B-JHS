
'use client';

import { useEffect, useState } from 'react';
import { FirebaseProvider, useUser } from './';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';

function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && profile?.status === 'Inactive' && pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-sm font-mono text-xs text-muted-foreground uppercase tracking-widest">Verifying Portal Access</p>
      </div>
    );
  }

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>;
  }

  if (!user || (profile && profile.status === 'Inactive')) {
    return null; // Prevents flashing secure content
  }

  return (
    <SidebarProvider>
      <div className="print:hidden">
        <MainNav />
      </div>
      <SidebarInset className="print:block">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="flex-1 p-4 sm:p-6 print:p-0 print:block">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <FirebaseProvider>
      <AppLayoutShell>{children}</AppLayoutShell>
    </FirebaseProvider>
  );
}
