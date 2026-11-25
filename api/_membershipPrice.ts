const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const LEGACY_ID = /^(?:price|plan)_[A-Za-z0-9]+$/;

export function membershipPriceConfiguration() {
  const current = process.env.STRIPE_PRICE_ID_SUBSCRIPTION?.trim() ?? "";
  const legacy = process.env.STRIPE_LEGACY_MEMBERSHIP_PRICE_IDS;
  const prices = [current, ...(legacy?.trim() ? legacy.split(",").map((id) => id.trim()) : [])];
  return PRICE_ID.test(current) && prices.every((id) => LEGACY_ID.test(id))
    ? { current, approved: new Set(prices) }
    : null;
}

type SubscriptionSnapshot = {
  items?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  cancel_at?: unknown;
  cancel_at_period_end?: unknown;
};

type SubscriptionItem = { price?: { id?: unknown }; current_period_end?: unknown };

function subscriptionItems(subscription: SubscriptionSnapshot): (SubscriptionItem | null)[] | null {
  const items = subscription.items as { data?: unknown; has_more?: unknown } | undefined;
  if (items?.has_more !== false || !Array.isArray(items.data) || items.data.length === 0) return null;
  return items.data as (SubscriptionItem | null)[];
}

export function subscriptionPriceIds(subscription: SubscriptionSnapshot) {
  const ids = subscriptionItems(subscription)?.map((item) => item?.price?.id);
  return ids?.every((id): id is string => typeof id === "string" && LEGACY_ID.test(id)) ? ids : null;
}

export function hasApprovedMembershipPrice(subscription: SubscriptionSnapshot) {
  const ids = subscriptionPriceIds(subscription);
  return ids?.length === 1 && membershipPriceConfiguration()?.approved.has(ids[0]) === true;
}

export function membershipPaidThrough(subscription: SubscriptionSnapshot): number | null {
  const items = subscriptionItems(subscription);
  const end = subscription.current_period_end ?? (items?.length === 1 ? items[0]?.current_period_end : null);
  const cancelAt = subscription.cancel_at;
  if (typeof end !== "number" || !Number.isFinite(end) || end <= 0 ||
      typeof subscription.cancel_at_period_end !== "boolean" ||
      (cancelAt !== null && (typeof cancelAt !== "number" || !Number.isFinite(cancelAt) || cancelAt <= 0))) {
    return null;
  }
  return cancelAt === null ? end : Math.min(end, cancelAt);
}

export function hasCurrentMembershipAccess(subscription: SubscriptionSnapshot) {
  if (subscription.status !== "active" && subscription.status !== "trialing") return false;
  const end = membershipPaidThrough(subscription);
  return end !== null && end > Date.now() / 1000 && hasApprovedMembershipPrice(subscription);
}

export function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && !("deleted" in value && value.deleted) &&
      "id" in value && typeof value.id === "string") return value.id || null;
  return null;
}
