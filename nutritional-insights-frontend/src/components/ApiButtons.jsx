export default function ApiButtons({ onInsights, onRecipes, onClusters, disabled }) {
  return (
    <div className="flex flex-wrap gap-4">
      <button
        onClick={onInsights}
        disabled={disabled}
        className="bg-blue-600 text-white py-2 px-4 rounded disabled:opacity-60"
      >
        Get Nutritional Insights
      </button>

      <button
        onClick={onRecipes}
        disabled={disabled}
        className="bg-green-600 text-white py-2 px-4 rounded disabled:opacity-60"
      >
        Get Recipes
      </button>

      <button
        onClick={onClusters}
        disabled={disabled}
        className="bg-purple-600 text-white py-2 px-4 rounded disabled:opacity-60"
      >
        Get Clusters
      </button>
    </div>
  );
}