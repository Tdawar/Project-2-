import { useState } from "react";

export default function OAuthLogin() {
  const [twoFaCode, setTwoFaCode] = useState("");

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">OAuth &amp; 2FA Integration</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-4">Secure Login</h3>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            onClick={() => alert("Google OAuth – integrate your provider here.")}
          >
            Login with Google
          </button>
          <button
            className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900"
            onClick={() => alert("GitHub OAuth – integrate your provider here.")}
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
        </div>
      </div>
    </section>
  );
}
