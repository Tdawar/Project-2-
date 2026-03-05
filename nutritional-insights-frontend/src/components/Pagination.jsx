export default function Pagination({ page, total = 0, pageSize = 10, onSet }) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2 mt-4 flex-wrap">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onSet(p)}
          className={`px-3 py-1 rounded ${
            p === page
              ? "bg-blue-600 text-white"
              : "bg-gray-300 hover:bg-gray-400"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}