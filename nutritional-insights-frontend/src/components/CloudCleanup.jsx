import { useCallback, useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function CloudCleanup() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cleanup/status`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoteStatus(null);
        return;
      }
      setRemoteStatus(json);
    } catch {
      setRemoteStatus(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleCleanup = async () => {
    setError("");
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cleanup`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        return;
      }
      setStatus(
        `Removed ${json.removedExpiredChallenges ?? 0} expired OTP challenge(s). ` +
          `CSV cache ${json.csvCacheCleared ? "cleared" : "was already empty"}.`
      );
      await loadStatus();
    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Cloud Resource Cleanup</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <p className="text-sm text-gray-600 mb-4">
          Ensure that cloud resources are efficiently managed and cleaned up
          post-deployment.
        </p>
        {remoteStatus && remoteStatus.ok && (
          <p className="text-xs text-gray-500 mb-3">
            Server: {remoteStatus.activeChallenges} active OTP challenge(s), CSV
            cache {remoteStatus.csvCacheLoaded ? "loaded" : "empty"}
            {remoteStatus.csvCacheRowCount != null
              ? ` (${remoteStatus.csvCacheRowCount} rows)`
              : ""}
            .
          </p>
        )}
        <button
          type="button"
          onClick={handleCleanup}
          disabled={loading}
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Cleaning…" : "Clean Up Resources"}
        </button>
        {error && (
          <p className="text-sm text-red-600 mt-3" role="alert">
            {error}
          </p>
        )}
        {status && !error && (
          <p className="text-sm text-green-600 mt-3">{status}</p>
        )}
      </div>
    </section>
  );
}
