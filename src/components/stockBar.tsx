"use client";

// Professional stock indicator — slim progress bar + count label.
// Green when stocked, amber when running low (under 50%), red when nearly
// gone (under 20%), solid red "SOLD" when empty. Used on the dashboard
// table, market cards, listing detail and the farmer-shop grid.

export default function StockBar({
  remaining,
  total,
  compact,
}: {
  remaining: number;
  total: number;
  compact?: boolean; // smaller variant for tight table cells
}) {
  const left = Math.max(0, remaining);
  const pct = total > 0 ? Math.round((left / total) * 100) : 0;

  let fillColor = "bg-[#2e7d32]";   // green — well stocked
  let textColor = "text-[#2e7d32]";
  if (left <= 0) {
    fillColor = "bg-red-500";
    textColor = "text-red-600";
  } else if (pct < 20) {
    fillColor = "bg-red-500";       // red — almost gone
    textColor = "text-red-600";
  } else if (pct < 50) {
    fillColor = "bg-[#f9a825]";     // amber — running low
    textColor = "text-[#e65100]";
  }

  if (left <= 0) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-bold uppercase tracking-wide ${textColor}`}>
        Sold out
      </span>
    );
  }

  return (
    <div className={compact ? "min-w-[86px]" : "min-w-[110px]"}>
      {/* progress track */}
      <div className={`w-full ${compact ? "h-1.5" : "h-2"} rounded-full bg-gray-100 overflow-hidden border border-gray-200`}>
        <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      {/* label */}
      <div className={`mt-1 ${compact ? "text-[10px]" : "text-xs"} font-semibold ${textColor} whitespace-nowrap`}>
        {left} of {total} left
        {pct < 50 && left > 0 && (
          <span className="ml-1 font-normal text-gray-400">· selling fast</span>
        )}
      </div>
    </div>
  );
}