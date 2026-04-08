function StatusBadge({ enabled }) {
  return (
    <span
      className={`font-semibold ${enabled ? "text-green-600" : "text-red-600"}`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default function SecurityCompliance({
  security,
  loading,
  error,
  onRefresh,
}) {
  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">
          Security &amp; Compliance
        </h2>
        <div className="bg-white p-4 shadow-lg rounded-lg text-sm text-gray-600">
          Loading security status...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">
          Security &amp; Compliance
        </h2>
        <div className="bg-red-50 border border-red-200 p-4 shadow-lg rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-3 bg-red-600 text-white py-1.5 px-3 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Security &amp; Compliance</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-2">Security Status</h3>
        <p className="text-sm text-gray-600">
          Helmet: <StatusBadge enabled={Boolean(security?.helmetEnabled)} />
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Rate Limiting:{" "}
          <StatusBadge enabled={Boolean(security?.rateLimitEnabled)} />
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Restricted CORS:{" "}
          <StatusBadge enabled={Boolean(security?.cors?.restricted)} />
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Session HttpOnly:{" "}
          <StatusBadge enabled={Boolean(security?.session?.httpOnly)} />
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 bg-blue-600 text-white py-2 px-4 rounded"
        >
          Refresh Security Status
        </button>
      </div>
    </section>
  );
}
