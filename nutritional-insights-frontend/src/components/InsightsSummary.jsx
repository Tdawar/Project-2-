function SummaryCard({ title, value }) {
  // Static extracted card avoids creating components during render.
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export default function InsightsSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SummaryCard title="Avg Calories" value={summary.avgCalories} />
      <SummaryCard title="Avg Protein (g)" value={summary.avgProtein} />
      <SummaryCard
        title="Best High-Protein Diet"
        value={summary.bestHighProtein || "-"}
      />
      <SummaryCard
        title="Best Low-Carb Diet"
        value={summary.bestLowCarb || "-"}
      />
    </div>
  );
}
