export default function RecipesList({ recipes = [] }) {
  if (!recipes.length) {
    return (
      <div className="text-sm text-gray-600 mt-3">
        No recipes found for these filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {recipes.map((r) => (
        <div key={r.id} className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold">{r.name}</h3>
          <div className="text-sm text-gray-600 mt-1">Diet: {r.dietType}</div>
          <div className="text-sm text-gray-600">Calories: {r.calories}</div>
          {"protein" in r && (
            <div className="text-sm text-gray-600">Protein: {r.protein}g</div>
          )}
        </div>
      ))}
    </div>
  );
}