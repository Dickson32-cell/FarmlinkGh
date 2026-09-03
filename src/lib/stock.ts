import { prisma } from "@/lib/prisma";

// Partial-stock engine.
// A listing's REMAINING stock is computed live from its orders:
//   remaining = listing.quantity - SUM(quantity of orders in a stock-consuming status)
// Consuming: pending, paid, delivered, released, refund_requested
//   (pending reserves the bags so two buyers can't both pay for the last 5;
//    refund_requested keeps them held until the admin settles the case)
// Returning: refunded, cancelled → the bags go back on the market automatically.

export const STOCK_CONSUMING = ["pending", "paid", "delivered", "released", "refund_requested"] as const;

// Remaining for ONE listing
export async function remainingFor(listingId: string, totalQuantity: number): Promise<number> {
  const agg = await prisma.order.aggregate({
    where: { listingId, status: { in: [...STOCK_CONSUMING] } },
    _sum: { quantity: true },
  });
  const consumed = agg._sum.quantity || 0;
  return Math.max(0, totalQuantity - consumed);
}

// Remaining for MANY listings (one grouped query) -> { [listingId]: remaining }
export async function remainingMap(listings: { id: string; quantity: number }[]): Promise<Record<string, number>> {
  if (listings.length === 0) return {};
  const grouped = await prisma.order.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listings.map((l) => l.id) }, status: { in: [...STOCK_CONSUMING] } },
    _sum: { quantity: true },
  });
  const consumed: Record<string, number> = {};
  for (const g of grouped) consumed[g.listingId] = g._sum.quantity || 0;
  const map: Record<string, number> = {};
  for (const l of listings) map[l.id] = Math.max(0, l.quantity - (consumed[l.id] || 0));
  return map;
}

// The status a listing SHOULD have, given its remaining stock.
// "sold" only when the LAST bag is gone — a 10-bag listing with 8 left stays available.
export function statusForRemaining(currentStatus: string, remaining: number): string {
  if (remaining <= 0) return "sold";
  // a "sold" listing that has stock again (e.g. refund returned bags) is available
  if (currentStatus === "sold") return "available";
  return currentStatus;
}