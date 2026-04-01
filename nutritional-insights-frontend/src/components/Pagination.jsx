export default function Pagination({ page, total = 0, pageSize = 10, onSet }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex justify-center gap-2 mt-4 flex-wrap">
      {/* Previous */}
      <button
        onClick={() => onSet(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      {/* Page numbers */}
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

      {/* Next */}
      <button
        onClick={() => onSet(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}