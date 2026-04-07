function StatusPill({ enabled }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function SecurityRow({ label, enabled, detail }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="font-semibold text-gray-800">{label}</div>
        <StatusPill enabled={enabled} />
      </div>
      {detail && <div className="text-sm text-gray-600 mt-2">{detail}</div>}
    </div>
  );
}

export default function SecurityCompliance({
  security,
  loading,
  error,
  onRefresh,
}) {
  if (loading) {
    return <div className="text-sm text-gray-600">Loading security status...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-700">{error}</div>
        <button
          onClick={onRefresh}
          className="mt-3 bg-red-600 text-white py-1.5 px-3 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!security) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        No security status data available.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SecurityRow
          label="Helmet"
          enabled={Boolean(security.helmetEnabled)}
          detail="Security headers are applied on backend responses."
        />

        <SecurityRow
          label="Rate Limiting"
          enabled={Boolean(security.rateLimitEnabled)}
          detail={`Window: ${Math.round((security.rateLimit?.windowMs || 0) / 60000)} min, Max: ${security.rateLimit?.max || 0} requests.`}
        />

        <SecurityRow
          label="Session Security"
          enabled={Boolean(security.session?.enabled)}
          detail={`Cookie: ${security.session?.cookieName || "-"}, HttpOnly: ${String(security.session?.httpOnly)}, SameSite: ${security.session?.sameSite || "-"}, Secure: ${String(security.session?.secure)}`}
        />

        <SecurityRow
          label="Restricted CORS"
          enabled={Boolean(security.cors?.restricted)}
          detail={`Allowed Origins: ${(security.cors?.allowedOrigins || []).join(", ") || "none"}`}
        />
      </div>

      <button
        onClick={onRefresh}
        className="mt-4 bg-blue-600 text-white py-2 px-4 rounded"
      >
        Refresh Security Status
      </button>
    </div>
  );
}
