export default function Filters({ search, setSearch, dietType, setDietType }) {
  return (
    <div className="flex flex-wrap gap-4">
      <input
        type="text"
        placeholder="Search by Diet Type"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="p-2 border rounded w-full sm:w-auto"
      />

      <select
        value={dietType}
        onChange={(e) => setDietType(e.target.value)}
        className="p-2 border rounded w-full sm:w-auto"
      >
        <option value="all">All Diet Types</option>
        <option value="vegan">Vegan</option>
        <option value="keto">Keto</option>
        <option value="vegetarian">Vegetarian</option>
      </select>
    </div>
  );
}