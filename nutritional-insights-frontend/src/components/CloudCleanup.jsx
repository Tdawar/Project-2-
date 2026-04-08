import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function CloudCleanup() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCleanup = async () => {
    setError("");
    setStatus("Initiating cleanup…");
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/api/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearCsvCache: true }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }

      const otpPart = `Removed ${json.removedExpiredOtpChallenges ?? 0} expired OTP challenge(s).`;
      const cachePart = json.csvCacheInvalidated
        ? " CSV cache cleared (next API load will re-read the file)."
        : " CSV cache left in memory.";
      setStatus(`${otpPart}${cachePart}`);
    } catch (e) {
      setStatus("");
      setError(e.message || "Cleanup failed");
    } finally {
      setBusy(false);
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
        <button
          type="button"
          onClick={handleCleanup}
          disabled={busy}
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Cleaning…" : "Clean Up Resources"}
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
