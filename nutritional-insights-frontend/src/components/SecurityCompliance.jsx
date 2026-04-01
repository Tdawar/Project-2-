import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function SecurityCompliance() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/security/privacy-status`, {
          credentials: "include",
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load security status");
        }

        setStatus(json);
      } catch (e) {
        setError(e.message || "Failed to load security status");
      }
    }

    loadStatus();
  }, []);

  const cards = [
    {
      label: "OAuth authentication enabled",
      value: "Google and GitHub sign-in available",
    },
    {
      label: "OTP verification enabled",
      value: status?.temporaryOtpStorage ? "Protected by temporary OTP" : "Unavailable",
    },
    {
      label: "Secure session cookies",
      value: status?.sessionCookiesProtected ? "Enabled" : "Unavailable",
    },
    {
      label: "Rate limiting enabled",
      value: status?.rateLimitingEnabled ? "Enabled" : "Unavailable",
    },
    {
      label: "Security headers enabled",
      value: status?.securityHeadersEnabled ? "Enabled" : "Unavailable",
    },
  ];

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Security &amp; Compliance</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-4">Security Status</h3>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-emerald-700">
                {card.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {status && (
          <div className="mt-4 text-left text-sm text-gray-600">
            <p>Minimal data collection: {status.minimalDataCollection ? "Yes" : "No"}</p>
            <p>Secrets stored in environment variables: {status.secretsStoredInEnv ? "Yes" : "No"}</p>
            <p>HTTPS expected in production: {status.httpsExpectedInProduction ? "Yes" : "No"}</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
