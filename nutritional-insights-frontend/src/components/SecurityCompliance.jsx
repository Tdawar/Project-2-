export default function SecurityCompliance() {
  const StatusBadge = ({ label }) => (
    <span className="font-semibold text-green-600">{label}</span>
  );

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Security &amp; Compliance</h2>
      <div className="bg-white p-4 shadow-lg rounded-lg">
        <h3 className="font-semibold mb-2">Security Status</h3>
        <p className="text-sm text-gray-600">
          Encryption: <StatusBadge label="Enabled" />
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Access Control: <StatusBadge label="Secure" />
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Compliance: <StatusBadge label="GDPR Compliant" />
        </p>
      </div>
    </section>
  );
}
