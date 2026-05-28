import Navbar from '@/components/Navbar';
import PushRegistrar from '@/components/PushRegistrar';
import OfflineBanner from '@/components/OfflineBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Navbar />
      <PushRegistrar />
      <main className="page-content">
        {children}
      </main>
      <OfflineBanner />
    </div>
  );
}
