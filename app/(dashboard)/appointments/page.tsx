'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/context/PermissionsContext';
import { queuedFetch } from '@/lib/queuedFetch';
import type { Appointment, Customer, Service, ServiceProvider, PaymentMethod } from '@/types';

// Convert a Date to the "YYYY-MM-DDTHH:MM" format that datetime-local inputs expect (local time, not UTC)
const toLocalISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
  NO_SHOW: 'badge-no-show',
  IN_PROGRESS: 'badge-in-progress',
};
const SERVICE_BADGE: Record<string, string> = {
  PENDING: 'badge-pending',
  IN_PROGRESS: 'badge-in-progress',
  DELIVERED: 'badge-delivered',
  PARTIAL: 'badge-partial',
  NOT_DELIVERED: 'badge-not-delivered',
};
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'ONLINE', 'VISA', 'MASTERCARD', 'PAYPAL', 'APPLE_PAY'];


type ModalType = 'create' | 'edit' | 'pay' | 'deliver' | 'reschedule' | 'history' | null;

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { t, lang, isRTL } = useLanguage();
  const { canDo } = usePermissions();

  const STATUS_LABEL: Record<string, string> = { SCHEDULED: t('scheduled'), COMPLETED: t('completed'), CANCELLED: t('cancelled'), NO_SHOW: t('noShow'), IN_PROGRESS: t('inProgress') };
  const SERVICE_LABEL: Record<string, string> = { PENDING: t('pending'), IN_PROGRESS: t('inProgress'), DELIVERED: t('delivered'), PARTIAL: t('partialLabel'), NOT_DELIVERED: t('notDelivered') };
  const STATUS_COLOR: Record<string, string> = { SCHEDULED: '#059669', COMPLETED: '#2563eb', CANCELLED: '#dc2626', NO_SHOW: '#d97706' };

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);

  // Form state
  const [form, setForm] = useState({
    dateTime: '', customerId: '', serviceId: '', serviceProviderId: '',
    notes: '', amount: '', paymentMethod: 'CASH' as PaymentMethod,
  });
  type ServiceLine = { serviceId: string; serviceProviderId: string; amount: string };
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ serviceId: '', serviceProviderId: '', amount: '' }]);
  const [payForm, setPayForm] = useState({ method: 'CASH' as PaymentMethod, amount: '' });
  const [deliverForm, setDeliverForm] = useState({ status: 'DELIVERED', notes: '', nextVisit: '' });
  const [newDateTime, setNewDateTime] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  // Counts visible items for a given appointment so we can pre-calculate dropdown height
  // at click time — avoids ref/layout timing issues entirely.
  const calcMenuHeight = (appt: Appointment): number => {
    let n = 0;
    if (canDo('editAppointments')) n++;
    if (canDo('updateAppointmentStatus') && appt.status === 'SCHEDULED') n += 3;
    if (canDo('updateAppointmentStatus') && appt.serviceStatus === 'PENDING' && appt.status === 'SCHEDULED') n++;
    if (canDo('updateAppointmentStatus') && appt.serviceStatus === 'IN_PROGRESS' && appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW') n++;
    if (canDo('recordPayments') && appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW') n++;
    if (canDo('editAppointments') && appt.status === 'SCHEDULED') n++;
    const hasDel = canDo('deleteAppointments');
    const hasSep = hasDel && n > 0;
    if (hasDel) n++;
    // 36px per item, 9px separator, 8px container vertical padding
    return n * 36 + (hasSep ? 9 : 0) + 8;
  };

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dd-wrap')) { setOpenMenuId(null); setMenuPos(null); }
    };
    const onScroll = () => { setOpenMenuId(null); setMenuPos(null); };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (activeBranchId) q.set('branchId', activeBranchId);
      const [apptRes, custRes, svcRes, provRes] = await Promise.all([
        fetch(`/api/appointments?${q}`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`/api/customers?${activeBranchId ? `branchId=${activeBranchId}` : ''}`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch('/api/services', { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`/api/providers?${activeBranchId ? `branchId=${activeBranchId}` : ''}`, { headers: { Authorization: `Bearer ${user.token}` } }),
      ]);
      if (apptRes.ok) setAppointments(await apptRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (svcRes.ok) setServices(await svcRes.json());
      if (provRes.ok) setProviders(await provRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [user, activeBranchId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setSelected(null);
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const defaultProvider = user?.providerId || '';
    setForm({ dateTime: toLocalISO(now), customerId: '', serviceId: '', serviceProviderId: defaultProvider, notes: '', amount: '', paymentMethod: 'CASH' });
    setServiceLines([{ serviceId: '', serviceProviderId: defaultProvider, amount: '' }]);
    setModal('create');
  };

  const openEdit = (a: Appointment) => {
    setSelected(a);
    setForm({
      dateTime: toLocalISO(new Date(a.dateTime)),
      customerId: a.customerId || '',
      serviceId: a.serviceId || '',
      serviceProviderId: a.serviceProviderId || '',
      notes: a.notes || '',
      amount: a.amount?.toString() || '',
      paymentMethod: a.paymentMethod || 'CASH',
    });
    setModal('edit');
  };

  const saveAppointment = async () => {
    if (saving) return;
    if (!form.dateTime) return toast.error(t('dateTimeRequired'));
    if (!form.customerId) return toast.error(t('required'));
    setSaving(true);

    // EDIT: single service/specialist (unchanged)
    if (selected) {
      if (!form.serviceId) return toast.error(t('required'));
      try {
        const body = {
          dateTime: new Date(form.dateTime).toISOString(),
          customerId: form.customerId || null,
          serviceId: form.serviceId || null,
          serviceProviderId: form.serviceProviderId || null,
          branchId: selected.branchId ?? activeBranchId,
          notes: form.notes || null,
          amount: form.amount ? parseFloat(form.amount) : null,
        };
        const res = await queuedFetch(`/api/appointments/${selected.id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (res.status !== 202 && !res.ok) throw new Error((await res.json()).error);
        toast.success(res.status === 202 ? '📡 Offline — saved locally' : t('apptUpdated'));
        setModal(null);
        load();
      } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
      finally { setSaving(false); }
      return;
    }

    // CREATE: one appointment per service line
    const validLines = serviceLines.filter(l => l.serviceId);
    if (validLines.length === 0) return toast.error(t('required'));
    try {
      const results = await Promise.all(validLines.map(line =>
        fetch('/api/appointments', {
          method: 'POST', headers,
          body: JSON.stringify({
            dateTime: new Date(form.dateTime).toISOString(),
            customerId: form.customerId || null,
            serviceId: line.serviceId || null,
            serviceProviderId: line.serviceProviderId || null,
            branchId: activeBranchId,
            notes: form.notes || null,
            amount: line.amount ? parseFloat(line.amount) : null,
          }),
        })
      ));
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) throw new Error('Some appointments failed to create');
      toast.success(validLines.length > 1 ? `${validLines.length} appointments created` : t('apptCreated'));
      setModal(null);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  };

  const doAction = async (appt: Appointment, action: string, data: Record<string, unknown> = {}) => {
    try {
      const res = await queuedFetch(`/api/appointments/${appt.id}/actions`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ action, ...data }),
      });
      if (res.status !== 202 && !res.ok) throw new Error((await res.json()).error);
      toast.success(res.status === 202 ? '📡 Offline — saved locally' : t('updatedSuccess'));
      setModal(null);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error'); }
  };

  const confirmDeleteAppt = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/appointments/${deleteTarget.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    if (res.ok) { toast.success(t('deleted')); setDeleteTarget(null); load(); }
    else toast.error(t('failedToDelete'));
  };

  const filtered = appointments.filter(a => {
    const matchSearch = !search ||
      a.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.service?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.serviceProvider?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <ProtectedRoute permKey="manageAppointments">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        button[style*="9px 16px"]:hover { background: rgba(229,62,90,0.07) !important; }
        .appt-row { transition: background 0.12s; cursor: default; }
        .appt-row:hover { background: var(--bg-elevated) !important; }
      `}} />
      <div>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('appointments')}</h1>
            <p className="page-sub">{filtered.length} {t('appointments').toLowerCase()}</p>
          </div>
          {canDo('createAppointments') && <button className="btn btn-primary" onClick={openCreate}>+ {t('newAppointment')}</button>}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              style={{ width: '100%' }}
              placeholder={t('searchBookings')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-pills">
            {[
              { key: 'ALL', label: t('allStatuses'), color: 'var(--text-sub)' },
              { key: 'SCHEDULED', label: t('scheduled'), color: '#059669' },
              { key: 'COMPLETED', label: t('completed'), color: '#2563eb' },
              { key: 'CANCELLED', label: t('cancelled'), color: '#dc2626' },
              { key: 'NO_SHOW', label: t('noShow'), color: '#d97706' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                  border: statusFilter === s.key ? `1.5px solid ${s.color}` : '1.5px solid var(--border)',
                  background: statusFilter === s.key ? `${s.color}18` : 'var(--bg-surface)',
                  color: statusFilter === s.key ? s.color : 'var(--text-sub)',
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                }}
              >
                {statusFilter === s.key && <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading && appointments.length === 0 ? (
          <div className="skeleton" style={{ height: '400px' }} />
        ) : (
          <div className="table-wrap">
            <table className="glass-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 20, width: '21%' }}>{t('customer')}</th>
                  <th style={{ textAlign: 'left', width: '22%' }}>{t('service')} / {t('specialist')}</th>
                  <th style={{ width: '13%' }}>{t('dateTime')}</th>
                  <th style={{ width: '18%' }}>{t('status')}</th>
                  <th style={{ width: '11%' }}>{t('amount')}</th>
                  <th style={{ width: '15%' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-sub)' }}>{t('noAppointments')}</td></tr>
                ) : filtered.map(appt => (
                  <tr key={appt.id} className="appt-row">
                    {/* Customer */}
                    <td data-label="Customer" style={{ textAlign: 'left', paddingLeft: 20, boxShadow: `inset 3px 0 0 ${STATUS_COLOR[appt.status] ?? 'var(--border)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--grad-soft)', border: '1.5px solid rgba(196,120,140,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.72rem', fontWeight: 800, color: 'var(--rose)',
                          letterSpacing: 0.5,
                        }}>
                          {(appt.customer?.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{appt.customer?.name || '—'}</div>
                          {appt.customer?.phone && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: 1 }}>{appt.customer.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Service + Specialist + service delivery status */}
                    <td data-label="Service" style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{(isRTL && appt.service?.nameAr ? appt.service.nameAr : appt.service?.name) || '—'}</div>
                      {appt.serviceProvider?.name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ opacity: 0.6 }}>👤</span>{appt.serviceProvider.name}
                        </div>
                      )}
                      {appt.serviceStatus && appt.serviceStatus !== 'PENDING' && (
                        <div style={{ marginTop: 5 }}>
                          <span className={`badge ${SERVICE_BADGE[appt.serviceStatus] ?? 'badge-pending'}`} style={{ fontSize: '0.62rem' }}>
                            {SERVICE_LABEL[appt.serviceStatus] ?? appt.serviceStatus}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Date + Time */}
                    <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>
                        {new Date(appt.dateTime).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--rose)', marginTop: 2, fontWeight: 600 }}>
                        {new Date(appt.dateTime).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Status — single badge only, always consistent height */}
                    <td data-label="Status">
                      <span className={`badge ${STATUS_BADGE[appt.status] ?? 'badge-pending'}`}>
                        {STATUS_LABEL[appt.status] ?? appt.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Amount + payment pill */}
                    <td data-label="Amount">
                      {appt.amount ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                          <div style={{
                            fontWeight: 700, fontSize: '0.9rem',
                            color: appt.paymentStatus === 'PAID' ? '#059669' : 'var(--text)',
                          }}>
                            ${appt.amount.toFixed(2)}
                          </div>
                          <span className={`badge ${appt.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-unpaid'}`} style={{ fontSize: '0.62rem' }}>
                            {appt.paymentStatus === 'PAID' ? t('paid') : t('unpaid')}
                          </span>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-sub)', fontSize: '0.82rem', textAlign: 'center' }}>—</div>
                      )}
                    </td>

                    {/* Actions */}
                    <td data-label="Actions">
                      <div className="dd-wrap" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const dropWidth = 190;
                            let left = rect.left;
                            if (left + dropWidth > window.innerWidth - 8) left = window.innerWidth - dropWidth - 8;
                            if (left < 8) left = 8;
                            const h = calcMenuHeight(appt);
                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                            const top = spaceBelow >= h ? rect.bottom + 4 : Math.max(8, rect.top - h - 4);
                            setMenuPos({ top, left });
                            setOpenMenuId(openMenuId === appt.id ? null : appt.id);
                          }}
                          style={{ padding: '4px 10px', fontWeight: 700, fontSize: '1rem', letterSpacing: 2, lineHeight: 1, flexShrink: 0 }}
                        >
                          •••
                        </button>
                        {openMenuId === appt.id && menuPos && (
                          <div style={{
                            position: 'fixed', top: menuPos.top, left: menuPos.left,
                            direction: 'ltr', zIndex: 9999,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                            minWidth: 190, padding: '4px 0', overflow: 'hidden',
                          }}>
                            {(() => {
                              const menuItems = [
                                ...(canDo('editAppointments') ? [{ label: `✏️  ${t('editDetails')}`, color: 'var(--text)', action: () => { openEdit(appt); setOpenMenuId(null); } }] : []),
                                ...(canDo('updateAppointmentStatus') && appt.status === 'SCHEDULED' ? [
                                  { label: `✓  ${t('markComplete')}`, color: '#10b981', action: () => { doAction(appt, 'complete'); setOpenMenuId(null); } },
                                  { label: `✗  ${t('noShow')}`, color: '#f59e0b', action: () => { doAction(appt, 'no-show'); setOpenMenuId(null); } },
                                  { label: `⊘  ${t('cancelAction')}`, color: '#ef4444', action: () => { doAction(appt, 'cancel'); setOpenMenuId(null); } },
                                ] : []),
                                ...(canDo('updateAppointmentStatus') && appt.serviceStatus === 'PENDING' && appt.status === 'SCHEDULED' ? [
                                  { label: `▶  ${t('startService')}`, color: '#f59e0b', action: () => { doAction(appt, 'start-service'); setOpenMenuId(null); } },
                                ] : []),
                                ...(canDo('updateAppointmentStatus') && appt.serviceStatus === 'IN_PROGRESS' && appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW' ? [
                                  { label: `📦  ${t('deliverService')}`, color: '#10b981', action: () => { setSelected(appt); setDeliverForm({ status: 'DELIVERED', notes: '', nextVisit: '' }); setModal('deliver'); setOpenMenuId(null); } },
                                ] : []),
                                ...(canDo('recordPayments') && appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW' ? (appt.paymentStatus === 'UNPAID' ? [
                                  { label: `💳  ${t('recordPayment')}`, color: '#10b981', action: () => { setSelected(appt); setPayForm({ method: 'CASH', amount: appt.amount?.toString() || '' }); setModal('pay'); setOpenMenuId(null); } },
                                ] : [
                                  { label: `↩  ${t('revertPayment')}`, color: '#f59e0b', action: () => { doAction(appt, 'unpay'); setOpenMenuId(null); } },
                                ]) : []),
                                ...(canDo('editAppointments') && appt.status === 'SCHEDULED' ? [
                                  { label: `📅  ${t('reschedule')}`, color: 'var(--text)', action: () => { setSelected(appt); setNewDateTime(toLocalISO(new Date(appt.dateTime))); setModal('reschedule'); setOpenMenuId(null); } },
                                ] : []),
                              ];
                              return (
                                <>
                                  {menuItems.map((item, i) => (
                                    <button key={i} onClick={item.action}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, color: item.color, transition: 'background 0.1s' }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                      {item.label}
                                    </button>
                                  ))}
                                  {canDo('deleteAppointments') && menuItems.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                                  )}
                                  {canDo('deleteAppointments') && (
                                    <button onClick={() => { setDeleteTarget(appt); setOpenMenuId(null); }}
                                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, color: '#e53e5a', transition: 'background 0.1s' }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,62,90,0.07)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                      🗑  {t('delete')}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create / Edit Modal ── */}
        {(modal === 'create' || modal === 'edit') && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes appt-pop { from { opacity:0; transform:scale(0.94) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }` }} />
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 620,
              boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px var(--border)',
              overflow: 'hidden', animation: 'appt-pop 0.22s cubic-bezier(.34,1.56,.64,1)',
            }}>
              {/* Gradient accent bar */}
              <div style={{ height: 4, background: 'var(--grad)' }} />

              {/* Header */}
              <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-rose)', fontSize: '1.15rem', flexShrink: 0 }}>📅</div>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                      {modal === 'create' ? t('newAppointment') : t('editAppt')}
                    </h2>
                  </div>
                </div>
                <button onClick={() => setModal(null)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}>✕</button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Row 1: Date + Customer */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">🗓 {t('dateTimeLabel')} <span style={{ color: 'var(--rose)' }}>*</span></label>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'stretch' }}>
                      <input className="form-input" type="datetime-local" value={form.dateTime}
                        onChange={e => setForm(f => ({ ...f, dateTime: e.target.value }))} style={{ flex: 1, minWidth: 0 }} />
                      <button type="button"
                        onClick={() => form.dateTime
                          ? toast.success(new Date(form.dateTime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
                          : toast.error(t('dateTimeRequired'))
                        }
                        style={{ flexShrink: 0, padding: '0 13px', borderRadius: 10, border: 'none', cursor: 'pointer', background: form.dateTime ? 'linear-gradient(135deg,#10b981,#059669)' : 'var(--bg-elevated)', color: form.dateTime ? '#fff' : 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                        ✓ {t('ok')}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">👤 {t('customer')} <span style={{ color: 'var(--rose)' }}>*</span></label>
                    <select className="form-select" value={form.customerId}
                      onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                      style={{ borderColor: form.customerId ? undefined : 'rgba(229,62,90,0.25)' }}>
                      <option value="">{t('selectCustomer')}</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Service lines (CREATE = multi, EDIT = single) */}
                {modal === 'edit' ? (
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">✦ {t('service')} <span style={{ color: 'var(--rose)' }}>*</span></label>
                      <select className="form-select" value={form.serviceId}
                        onChange={e => {
                          const svc = services.find(s => s.id === e.target.value);
                          setForm(f => ({ ...f, serviceId: e.target.value, amount: svc ? svc.price.toString() : f.amount }));
                        }}
                        style={{ borderColor: form.serviceId ? undefined : 'rgba(229,62,90,0.25)' }}>
                        <option value="">{t('selectService')}</option>
                        {services.map(s => <option key={s.id} value={s.id}>{(isRTL && s.nameAr ? s.nameAr : s.name)} — ${s.price.toFixed(2)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">🩺 {t('specialist')}</label>
                      <select className="form-select" value={form.serviceProviderId}
                        onChange={e => setForm(f => ({ ...f, serviceProviderId: e.target.value }))}>
                        <option value="">{t('selectSpecialist')}</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Multi-service lines for CREATE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      ✦ {t('service')} / 🩺 {t('specialist')} <span style={{ color: 'var(--rose)' }}>*</span>
                    </div>
                    {serviceLines.map((line, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bg-elevated)', borderRadius: 12, padding: '10px 12px', border: '1px solid var(--border)', position: 'relative' }}>
                        {/* Line number */}
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--grad)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{idx + 1}</div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                          <select className="form-select" value={line.serviceId}
                            style={{ fontSize: '0.85rem', borderColor: line.serviceId ? undefined : 'rgba(229,62,90,0.3)' }}
                            onChange={e => {
                              const svc = services.find(s => s.id === e.target.value);
                              setServiceLines(prev => prev.map((l, i) => i === idx ? { ...l, serviceId: e.target.value, amount: svc ? svc.price.toString() : l.amount } : l));
                            }}>
                            <option value="">{t('selectService')}</option>
                            {services.map(s => <option key={s.id} value={s.id}>{(isRTL && s.nameAr ? s.nameAr : s.name)} — ${s.price.toFixed(2)}</option>)}
                          </select>
                          <select className="form-select" value={line.serviceProviderId}
                            style={{ fontSize: '0.85rem' }}
                            onChange={e => setServiceLines(prev => prev.map((l, i) => i === idx ? { ...l, serviceProviderId: e.target.value } : l))}>
                            <option value="">{t('selectSpecialist')}</option>
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input className="form-input" type="number" step="0.01" placeholder="$0.00"
                              value={line.amount} onChange={e => setServiceLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                              style={{ width: 80, fontSize: '0.85rem' }} />
                            {serviceLines.length > 1 && (
                              <button type="button" onClick={() => setServiceLines(prev => prev.filter((_, i) => i !== idx))}
                                style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(229,62,90,0.1)', border: '1px solid rgba(229,62,90,0.25)', color: '#e53e5a', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setServiceLines(prev => [...prev, { serviceId: '', serviceProviderId: '', amount: '' }])}
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--rose)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--rose)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-sub)'; }}>
                      + {isRTL ? 'إضافة خدمة أخرى' : 'Add another service'}
                    </button>
                    {serviceLines.length > 1 && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'inline-flex', gap: 6, alignSelf: 'flex-start' }}>
                        💰 {isRTL ? 'الإجمالي:' : 'Total:'} <strong style={{ color: 'var(--text)' }}>${serviceLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">📝 {t('notes')}</label>
                  <input className="form-input" type="text" placeholder={t('notesPlaceholder')}
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                {/* Amount (edit only) */}
                {modal === 'edit' && (
                <div className="form-group">
                  <label className="form-label">💵 {t('amountUsd')}</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={saveAppointment} disabled={saving} style={{ minWidth: 130, opacity: saving ? 0.7 : 1 }}>
                  {saving ? '...' : (modal === 'create' ? t('createAppt') : t('saveChanges'))}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pay Modal ── */}
        {modal === 'pay' && selected && (
          <div className="modal-overlay">
            <div className="modal modal-sm">
              <div className="modal-header">
                <h2 className="modal-title">{t('recordPayment')}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                  {t('customer')}: <strong>{selected.customer?.name || t('unknown')}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">{t('paymentMethod')}</label>
                  <select className="form-select" value={payForm.method}
                    onChange={e => setPayForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('amountUsd')}</label>
                  <input className="form-input" type="number" step="0.01"
                    value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={selected.amount?.toFixed(2) || '0.00'} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={() => doAction(selected, 'pay', { paymentMethod: payForm.method, amount: payForm.amount })}>
                  {t('confirmPayment')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Deliver Modal ── */}
        {modal === 'deliver' && selected && (
          <div className="modal-overlay">
            <div className="modal modal-sm">
              <div className="modal-header">
                <h2 className="modal-title">{t('serviceDelivery')}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('deliveryStatus')}</label>
                  <select className="form-select" value={deliverForm.status}
                    onChange={e => setDeliverForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="DELIVERED">{t('delivered')}</option>
                    <option value="PARTIAL">{t('partiallyDelivered')}</option>
                    <option value="NOT_DELIVERED">{t('notDelivered')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('deliveryNotes')}</label>
                  <textarea className="form-textarea" placeholder={t('deliveryNotesPlaceholder')}
                    value={deliverForm.notes}
                    onChange={e => setDeliverForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('nextVisitDate')}</label>
                  <input className="form-input" type="text" placeholder={t('nextVisitPlaceholder')}
                    value={deliverForm.nextVisit}
                    onChange={e => setDeliverForm(f => ({ ...f, nextVisit: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={() => {
                  const actionMap: Record<string, string> = {
                    DELIVERED: 'deliver', PARTIAL: 'partial-deliver', NOT_DELIVERED: 'not-deliver',
                  };
                  doAction(selected, actionMap[deliverForm.status], { notes: deliverForm.notes, nextVisit: deliverForm.nextVisit });
                }}>
                  {t('saveDelivery')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Reschedule Modal ── */}
        {modal === 'reschedule' && selected && (
          <div className="modal-overlay">
            <div className="modal modal-sm">
              <div className="modal-header">
                <h2 className="modal-title">{t('rescheduleAppt')}</h2>
                <button className="modal-close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                  {t('reschedulingFor')} <strong>{selected.customer?.name || t('unknown')}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">{t('newDateTimeLabel')}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input className="form-input" type="datetime-local" value={newDateTime}
                      onChange={e => setNewDateTime(e.target.value)}
                      style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => newDateTime
                        ? toast.success(new Date(newDateTime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
                        : toast.error(t('dateTimeRequired'))
                      }
                      style={{
                        flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: newDateTime ? 'linear-gradient(135deg,#10b981,#059669)' : 'var(--bg-elevated)',
                        color: newDateTime ? '#fff' : 'var(--text-sub)',
                        fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font)',
                        transition: 'all 0.15s', whiteSpace: 'nowrap',
                      }}
                    >
                      ✓ {t('ok')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={() => doAction(selected, 'reschedule', { dateTime: new Date(newDateTime).toISOString() })}>
                  {t('confirmReschedule')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ── */}
        {deleteTarget && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 24, width: '100%', maxWidth: 380, boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(229,62,90,0.12)', overflow: 'hidden', animation: 'del-pop 0.22s cubic-bezier(.34,1.56,.64,1)' }}>
              <style dangerouslySetInnerHTML={{ __html: `@keyframes del-pop { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }` }} />
              <div style={{ height: 5, background: 'linear-gradient(90deg,#e53e5a,#ff6b81)' }} />
              <div style={{ padding: '28px 28px 24px', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(229,62,90,0.10)', border: '1.5px solid rgba(229,62,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e53e5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{t('deleteAppt')}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
                  {t('deleteApptFor')} <strong style={{ color: 'var(--text)' }}>{deleteTarget.customer?.name || t('unknown')}</strong>? {t('deleteApptConfirm')}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('cancel')}</button>
                  <button onClick={confirmDeleteAppt} disabled={deleting} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#e53e5a,#c0392b)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                    {deleting ? t('deleting') : t('delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
