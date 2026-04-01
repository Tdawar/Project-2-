import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function OAuthLogin() {
  const [twoFaCode, setTwoFaCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function startLogin(selectedProvider) {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to start login");
      }

      setProvider(json.provider);
      setChallengeId(json.challengeId);
      setStatus(
        `Code sent. Demo code: ${json.demoCode}. Enter it below to finish ${json.provider} login.`
      );
    } catch (e) {
      setStatus(`Login error: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function verify2FA() {
    if (!challengeId) {
      setStatus("Start login with Google or GitHub first.");
      return;
    }

    if (twoFaCode.length !== 6) {
      setStatus("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: twoFaCode }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "2FA verification failed");
      }

      setStatus(`Success: ${json.message}`);
      setChallengeId("");
      setProvider("");
      setTwoFaCode("");
    } catch (e) {
      setStatus(`Verification error: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">OAuth &amp; 2FA Integration</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-4">Secure Login</h3>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
            onClick={() => startLogin("google")}
            disabled={loading}
          >
            Login with Google
          </button>
          <button
            className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 disabled:opacity-60"
            onClick={() => startLogin("github")}
            disabled={loading}
          >
            Login with GitHub
          </button>
        </div>

        <div>
          <label htmlFor="twofa" className="block text-sm text-gray-600 mb-1">
            Enter 2FA Code
          </label>
          <input
            id="twofa"
            type="text"
            maxLength={6}
            value={twoFaCode}
            onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter your 2FA code"
            className="p-2 border rounded w-full sm:w-64"
          />

          <button
            className="ml-0 sm:ml-3 mt-3 sm:mt-0 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-60"
            onClick={verify2FA}
            disabled={loading}
          >
            Verify 2FA
          </button>

          {provider && challengeId && (
            <p className="text-xs text-gray-500 mt-2">
              Active provider: {provider}
            </p>
          )}

          {status && (
            <p className="text-sm mt-3 text-gray-700">{status}</p>
          )}
        </div>
      </div>
    </section>
  );
}
