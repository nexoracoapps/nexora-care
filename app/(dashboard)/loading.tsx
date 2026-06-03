export default function DashboardLoading() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="skeleton" style={{ height: 36, width: 220, borderRadius: 10, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 20, width: 140, borderRadius: 8, marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
    </div>
  );
}
