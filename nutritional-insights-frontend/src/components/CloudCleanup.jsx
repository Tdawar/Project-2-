import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function CloudCleanup() {
  const [status, setStatus] = useState("");
  const [cleanupData, setCleanupData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCleanupStatus();
  }, []);

  async function loadCleanupStatus() {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/admin/cleanup-status`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load cleanup status");
      }

      setCleanupData(json);
    } catch (e) {
      setStatus(e.message || "Failed to load cleanup status");
    } finally {
      setLoading(false);
    }
  }

  async function runCleanup() {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/admin/run-cleanup`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "Cleanup failed");
      }

      setCleanupData((current) => ({
        ...(current || {}),
        otpEntries: json.otpEntries,
        cacheEntries: json.cacheEntries,
      }));
      setStatus(json.message);
    } catch (e) {
      setStatus(e.message || "Cleanup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Cleanup</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <p className="text-sm text-gray-600 mb-4">
          Automatic cleanup removes expired OTP codes and cache entries every
          few minutes, and you can also run it manually for the project demo.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runCleanup}
            disabled={loading}
            className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-60"
          >
            Run Cleanup
          </button>
          <button
            onClick={loadCleanupStatus}
            disabled={loading}
            className="bg-slate-700 text-white py-2 px-4 rounded hover:bg-slate-800 disabled:opacity-60"
          >
            Refresh Cleanup Status
          </button>
        </div>
        {cleanupData && (
          <div className="mt-4 grid gap-3 text-left md:grid-cols-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">OTP entries</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{cleanupData.otpEntries}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Cache entries</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{cleanupData.cacheEntries}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Automatic cleanup</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {cleanupData.automaticCleanupEnabled ? "Active" : "Disabled"} every{" "}
                {cleanupData.cleanupIntervalMinutes} minutes
              </p>
            </div>
          </div>
        )}
        {status && (
          <p className="text-sm text-green-600 mt-3">{status}</p>
        )}
      </div>
    </section>
  );
}
