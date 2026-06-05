'use client';

import { useState, useEffect, useCallback } from 'react';
import { swrGet, swrSet } from '@/lib/swrCache';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import Icon from '@/components/ui/Icon';
import type { CallLog } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#10b981', NO_ANSWER: '#d97706', FAILED: '#e53e5a',
};

export default function CallLogsPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.token) return;
    const ck = '/api/call-logs';
    const stale = swrGet<typeof logs>(ck);
    if (stale) { setLogs(stale); setLoading(false); } else setLoading(true);
    const res = await fetch(ck, { headers: { Authorization: `Bearer ${user.token}` } });
    if (res.ok) { const d = await res.json(); setLogs(d); swrSet(ck, d); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l =>
    !search ||
    l.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    (l.customer as { name?: string } | null | undefined)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabel = (s: string) => {
    if (s === 'COMPLETED') return t('callCompleted');
    if (s === 'NO_ANSWER') return t('callNoAnswer');
    if (s === 'FAILED') return t('callFailed');
    return s.replace('_', ' ');
  };

  const formatDuration = (s?: number | null) => {
    if (!s) return '—';
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <ProtectedRoute permKey="viewCallLogs">
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('callLogs')}</h1>
            <p className="page-sub">{filtered.length} {t('noCallLogs') === 'No call logs found' ? (filtered.length !== 1 ? 'calls' : 'call') : t('callLogs').toLowerCase()} {t('recorded')}</p>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input className="search-input" placeholder={t('searchByCustomer')} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : (
          <div className="table-wrap">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>{t('customer')}</th>
                  <th>{t('dateTime')}</th>
                  <th>{t('duration')}</th>
                  <th>{t('status')}</th>
                  <th>{t('notes')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>{t('noCallLogs')}</td></tr>
                ) : filtered.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>
                      {log.customer ? (log.customer as { name: string }).name : log.customerName || '—'}
                    </td>
                    <td style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }}>
                      {new Date(log.startedAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontFeatureSettings: '"tnum"' }}>
                      {formatDuration(log.durationSeconds)}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                        background: `${STATUS_COLOR[log.status]}18`,
                        color: STATUS_COLOR[log.status],
                        border: `1px solid ${STATUS_COLOR[log.status]}33`,
                      }}>
                        {statusLabel(log.status)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-sub)', fontSize: '0.875rem' }} className="truncate">
                      {log.notes || '—'}
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
