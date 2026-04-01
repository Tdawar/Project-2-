import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

export default function OAuthLogin() {
  const [twoFaCode, setTwoFaCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [providerAvailability, setProviderAvailability] = useState({
    google: true,
    github: true,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthChallenge = params.get("oauthChallenge");
    const oauthProvider = params.get("oauthProvider");
    const oauthEmail = params.get("oauthEmail");
    const authError = params.get("authError");

    if (oauthChallenge && oauthProvider) {
      setChallengeId(oauthChallenge);
      setProvider(oauthProvider);
      setMaskedEmail(oauthEmail || "not-available");
      setStatus("OAuth successful. Enter the OTP sent to your email.");
      params.delete("oauthChallenge");
      params.delete("oauthProvider");
      params.delete("oauthEmail");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }

    if (authError) {
      setStatus(`Login error: ${authError.replaceAll("_", " ")}`);
      params.delete("authError");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/providers`, {
          credentials: "include",
        });
        const json = await res.json();
        if (res.ok && json.ok && json.providers) {
          setProviderAvailability({
            google: Boolean(json.providers.google),
            github: Boolean(json.providers.github),
          });
        }
      } catch {
        // Keep defaults so local/offline development still renders controls.
      }
    }

    loadProviders();
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        setCurrentUser(null);
        return;
      }

      const json = await res.json();
      setCurrentUser(json.user || null);
    } catch {
      setCurrentUser(null);
    }
  }

  function startLogin(selectedProvider) {
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.href = `${API_BASE}/api/auth/oauth/${selectedProvider}/start?returnTo=${encodeURIComponent(returnTo)}`;
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
        credentials: "include",
        body: JSON.stringify({ challengeId, code: twoFaCode }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "2FA verification failed");
      }

      setStatus(`Success: ${json.message}`);
      setChallengeId("");
      setProvider("");
      setMaskedEmail("");
      setTwoFaCode("");
      setCurrentUser(json.user || null);
    } catch (e) {
      setStatus(`Verification error: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Logout failed");
      }

      setCurrentUser(null);
      setChallengeId("");
      setProvider("");
      setMaskedEmail("");
      setTwoFaCode("");
      setStatus(json.message);
    } catch (e) {
      setStatus(`Logout error: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-4">Secure Login</h3>

        <p className="text-sm text-gray-600 mb-4">
          We only store the minimum information needed for authentication, such
          as your name, email, and login provider. OTP codes are temporary and
          automatically removed after expiration.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
            onClick={() => startLogin("google")}
            disabled={loading || !providerAvailability.google}
          >
            Login with Google
          </button>
          <button
            className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 disabled:opacity-60"
            onClick={() => startLogin("github")}
            disabled={loading || !providerAvailability.github}
          >
            Login with GitHub
          </button>
        </div>

        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-left">
          <p className="text-sm font-medium text-slate-800">Current Session</p>
          {currentUser ? (
            <div className="mt-2 text-sm text-slate-700">
              <p>Name: {currentUser.name}</p>
              <p>Email: {currentUser.email}</p>
              <p>Provider: {currentUser.provider}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No authenticated user is currently stored in the session.
            </p>
          )}
        </div>

        {(!providerAvailability.google || !providerAvailability.github) && (
          <p className="text-xs text-amber-700 mb-3">
            One or more OAuth providers are not configured on the backend.
          </p>
        )}

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

          <button
            className="ml-0 sm:ml-3 mt-3 sm:mt-0 bg-slate-700 text-white py-2 px-4 rounded hover:bg-slate-800 disabled:opacity-60"
            onClick={logout}
            disabled={loading || !currentUser}
          >
            Logout
          </button>

          {provider && challengeId && (
            <p className="text-xs text-gray-500 mt-2">
              Active provider: {provider}{maskedEmail ? ` (${maskedEmail})` : ""}
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
