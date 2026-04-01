export default function ClustersList({ clusters = [] }) {
  if (!clusters.length) {
    return (
      <div className="text-sm text-gray-600 mt-3">
        No cluster data available.
      </div>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="text-2xl font-semibold mb-4">Cluster Results</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusters.map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold">{item.name}</h3>
            <div className="text-sm text-gray-600 mt-1">Diet: {item.dietType}</div>
            <div className="text-sm text-gray-600">Cluster: #{item.cluster}</div>
            <div className="text-sm text-gray-600">Protein: {item.protein}g</div>
            <div className="text-sm text-gray-600">Carbs: {item.carbs}g</div>
            <div className="text-sm text-gray-600">Fat: {item.fat}g</div>
          </div>
        ))}
      </div>
    </section>
  );
}