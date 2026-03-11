export default function ClustersList({ clusters = [] }) {
  // Show a clear empty state when clustering returns no data.
  if (!clusters.length) {
    return (
      <div className="text-sm text-gray-600 mt-3">
        No cluster data found for these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {clusters.map((item) => (
        <div
          // Deterministic key avoids React reconciliation issues.
          key={`${item.name}-${item.dietType}-${item.cluster}-${item.protein}-${item.carbs}-${item.fat}`}
          className="bg-white p-4 rounded-lg shadow"
        >
          <h3 className="font-semibold">{item.name}</h3>
          <div className="text-sm text-gray-600 mt-1">
            Diet: {item.dietType}
          </div>
          <div className="text-sm text-gray-600">Cluster: {item.cluster}</div>
          <div className="text-sm text-gray-600">Protein: {item.protein}g</div>
          <div className="text-sm text-gray-600">Carbs: {item.carbs}g</div>
          <div className="text-sm text-gray-600">Fat: {item.fat}g</div>
        </div>
      ))}
    </div>
  );
}
