function buildPages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push("ellipsis-left");
  }

  for (let value = start; value <= end; value += 1) {
    pages.push(value);
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis-right");
  }

  pages.push(totalPages);

  return pages;
}

export default function Pagination({ page, total = 0, pageSize = 10, onSet }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visiblePages = buildPages(currentPage, totalPages);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm text-gray-600 text-center">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => onSet(currentPage - 1)}
          disabled={currentPage <= 1}
          className="min-w-[5.5rem] px-3 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {visiblePages.map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              onClick={() => onSet(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={`min-w-10 px-3 py-2 rounded ${
                item === currentPage
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              className="min-w-10 px-2 py-2 text-center text-gray-500"
            >
              ...
            </span>
          ),
        )}

        <button
          onClick={() => onSet(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="min-w-[5.5rem] px-3 py-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
