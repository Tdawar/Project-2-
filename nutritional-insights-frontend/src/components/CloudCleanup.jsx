import { useState } from "react";

export default function CloudCleanup() {
  const [status, setStatus] = useState("");

  const handleCleanup = () => {
    setStatus("Initiating cleanup…");
    setTimeout(() => setStatus("Cloud resources cleaned up successfully."), 1500);
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
          onClick={handleCleanup}
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
        >
          Clean Up Resources
        </button>
        {status && (
          <p className="text-sm text-green-600 mt-3">{status}</p>
        )}
      </div>
    </section>
  );
}
