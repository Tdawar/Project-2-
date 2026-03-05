export default function InsightsSummary({ summary }) {
  if (!summary) return null;

  const Card = ({ title, value }) => (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card title="Avg Calories" value={summary.avgCalories} />
      <Card title="Avg Protein (g)" value={summary.avgProtein} />
      <Card title="Best High-Protein Diet" value={summary.bestHighProtein || "—"} />
      <Card title="Best Low-Carb Diet" value={summary.bestLowCarb || "—"} />
    </div>
  );
}