'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Appointment } from '@/types';

type PaymentAppointment = Appointment & { branch?: { name: string; nameAr?: string | null } };

const METHOD_ICON: Record<string, string> = {
  CASH: '💵', CREDIT_CARD: '💳', BANK_TRANSFER: '🏦', INSURANCE: '🏥', OTHER: '📋',
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { t, lang, isRTL } = useLanguage();
  const [payments, setPayments] = useState<PaymentAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    const q = activeBranchId ? `?branchId=${activeBranchId}` : '';
    const res = await fetch(`/api/payments${q}`, { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) setPayments(await res.json());
    setLoading(false);
  }, [user, activeBranchId]);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter(p =>
    !search ||
    p.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.service?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);

  const methodLabel = (m?: string | null) => {
    if (!m) return '—';
    const labels: Record<string, { en: string; ar: string }> = {
      CASH: { en: 'Cash', ar: 'نقداً' },
      CREDIT_CARD: { en: 'Credit Card', ar: 'بطاقة ائتمان' },
      BANK_TRANSFER: { en: 'Bank Transfer', ar: 'تحويل بنكي' },
      INSURANCE: { en: 'Insurance', ar: 'تأمين' },
      OTHER: { en: 'Other', ar: 'أخرى' },
    };
    const entry = labels[m];
    if (!entry) return m.replace(/_/g, ' ');
    return isRTL ? entry.ar : entry.en;
  };

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <ProtectedRoute roles={['ADMIN','MANAGER']} permKey="recordPayments">
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('payments')}</h1>
            <p className="page-sub">
              {t('totalCollected')}: <strong style={{ color: 'var(--rose)' }}>${totalRevenue.toFixed(2)}</strong>
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder={t('searchPayments')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 400 }} />
        ) : (
          <div className="table-wrap">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>{t('customer')}</th>
                  <th>{t('service')}</th>
                  <th>{t('date')}</th>
                  <th>{t('method')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('branch')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>{t('noPayments')}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id}>
                    <td data-label="Customer" style={{ fontWeight: 600 }}>{p.customer?.name || '—'}</td>
                    <td data-label="Service" style={{ color: 'var(--text-muted)' }}>
                      {isRTL && (p.service as any)?.nameAr ? (p.service as any).nameAr : p.service?.name || '—'}
                    </td>
                    <td data-label="Date" style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }}>
                      {new Date(p.updatedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td data-label="Method">
                      <span style={{
                        background: 'var(--bg-elevated)', padding: '3px 10px',
                        borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <span>{METHOD_ICON[p.paymentMethod || ''] || '💳'}</span>
                        {methodLabel(p.paymentMethod)}
                      </span>
                    </td>
                    <td data-label="Amount" style={{ fontWeight: 700, color: 'var(--rose)', fontSize: '1rem' }}>
                      ${(p.amount || 0).toFixed(2)}
                    </td>
                    <td data-label="Branch" style={{ color: 'var(--text-sub)' }}>
                      {isRTL && p.branch?.nameAr ? p.branch.nameAr : p.branch?.name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
