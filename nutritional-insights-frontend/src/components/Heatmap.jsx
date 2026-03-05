function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function corrToAlpha(v) {
  // correlation often -1..1, convert to 0..1-ish
  const normalized = (v + 1) / 2; // -1..1 -> 0..1
  return clamp(0.15 + normalized * 0.75, 0.15, 0.9);
}

export default function Heatmap({ labels = [], values = [] }) {
  if (!labels.length || !values.length) {
    return (
      <div className="h-full w-full bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">
        No heatmap data
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${labels.length + 1}, minmax(28px, 1fr))`,
        }}
      >
        {/* top-left empty */}
        <div />

        {/* column labels */}
        {labels.map((l) => (
          <div key={`col-${l}`} className="text-[10px] text-center text-gray-500">
            {l}
          </div>
        ))}

        {/* rows */}
        {labels.map((rowLabel, r) => (
          <div key={`row-${rowLabel}`} className="contents">
            <div className="text-[10px] text-gray-500 flex items-center">
              {rowLabel}
            </div>

            {labels.map((_, c) => {
              const v = values?.[r]?.[c] ?? 0;
              const alpha = corrToAlpha(v);

              // Blue shade, intensity based on correlation
              const bg = `rgba(37, 99, 235, ${alpha})`;

              return (
                <div
                  key={`cell-${r}-${c}`}
                  className="rounded"
                  style={{ background: bg, minHeight: 22 }}
                  title={`corr: ${v}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}