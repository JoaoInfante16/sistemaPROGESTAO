import { Sidebar } from '@/components/sidebar';
import { Toaster } from '@/components/ui/sonner';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
