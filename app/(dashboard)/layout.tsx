import Navbar from '@/components/Navbar';
import PushRegistrar from '@/components/PushRegistrar';
import OfflineBanner from '@/components/OfflineBanner';
import OfflineGuard from '@/components/OfflineGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Navbar />
      <PushRegistrar />
      <OfflineGuard />
      <main className="page-content">
        {children}
      </main>
      <OfflineBanner />
    </div>
  );
}
