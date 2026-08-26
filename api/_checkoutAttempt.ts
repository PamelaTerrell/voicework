import type Stripe from "stripe";
import { stripe, supabaseAdmin } from "./_lib.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{10,}$/;
const ATTEMPT_COLUMNS = [
  "user_id",
  "attempt_id",
  "generation",
  "state",
  "stripe_customer_id",
  "stripe_checkout_session_id",
  "stripe_price_id",
  "success_url",
  "cancel_url",
  "stripe_expires_at",
].join(", ");

type AttemptState = "creating" | "open" | "completed" | "expired" | "blocked";
type TerminalState = "completed" | "expired";

export type CheckoutAttempt = {
  userId: string;
  attemptId: string;
  generation: number;
  state: AttemptState;
  customerId: string;
  sessionId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  stripeExpiresAt: number;
};

export type CheckoutAttemptClaim =
  | { outcome: "busy" | "blocked" }
  | ({ outcome: "open" } & CheckoutAttempt)
  | ({ outcome: "new" | "reclaimed" | "rotated"; leaseToken: string } & CheckoutAttempt);

export type CheckoutAttemptBinding =
  | { outcome: "bound_open"; state: "open" }
  | { outcome: "bound_completed"; state: "completed" }
  | { outcome: "bound_expired"; state: "expired" };

export type OwnedSessionInspection =
  | { state: "open"; url: string; expiresAt: number }
  | { state: TerminalState; expiresAt: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function rpcRow(data: unknown): Record<string, unknown> | null {
  return Array.isArray(data) && data.length === 1 && isRecord(data[0])
    ? data[0]
    : null;
}

function checkoutUrl(value: unknown): string | null {
  if (!isNonemptyString(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (
      url.hostname !== "checkout.stripe.com" &&
      !url.hostname.endsWith(".checkout.stripe.com")
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sessionCustomerId(customer: unknown): string | null {
  if (isNonemptyString(customer)) return customer;
  if (!isRecord(customer) || !isNonemptyString(customer.id)) return null;
  if ("deleted" in customer && customer.deleted !== false) return null;
  return customer.id;
}

function parseAttemptRow(value: unknown): CheckoutAttempt | null {
  if (!isRecord(value)) return null;
  const state = value.state;
  if (
    state !== "creating" &&
    state !== "open" &&
    state !== "completed" &&
    state !== "expired" &&
    state !== "blocked"
  ) return null;

  const sessionId = value.stripe_checkout_session_id;
  if (sessionId !== null && !isNonemptyString(sessionId)) return null;
  const expiresAt = isPositiveInteger(value.stripe_expires_at)
    ? value.stripe_expires_at
    : null;

  if (
    !isNonemptyString(value.user_id) ||
    !isNonemptyString(value.attempt_id) ||
    !UUID.test(value.attempt_id) ||
    !isPositiveInteger(value.generation) ||
    !isNonemptyString(value.stripe_customer_id) ||
    !isNonemptyString(value.stripe_price_id) ||
    !isNonemptyString(value.success_url) ||
    !isNonemptyString(value.cancel_url) ||
    expiresAt === null
  ) return null;

  if (
    (state === "open" || state === "completed") &&
    (!sessionId || !CHECKOUT_SESSION_ID.test(sessionId) || expiresAt === null)
  ) return null;
  if (state === "expired" && sessionId && !CHECKOUT_SESSION_ID.test(sessionId)) {
    return null;
  }
  if (state === "creating" && sessionId !== null) return null;

  return {
    userId: value.user_id,
    attemptId: value.attempt_id,
    generation: value.generation,
    state,
    customerId: value.stripe_customer_id,
    sessionId,
    priceId: value.stripe_price_id,
    successUrl: value.success_url,
    cancelUrl: value.cancel_url,
    stripeExpiresAt: expiresAt,
  };
}

export async function claimCheckoutAttempt(args: {
  userId: string;
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutAttemptClaim> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_subscription_checkout_attempt",
    {
      p_user_id: args.userId,
      p_stripe_customer_id: args.customerId,
      p_stripe_price_id: args.priceId,
      p_success_url: args.successUrl,
      p_cancel_url: args.cancelUrl,
    },
  );
  if (error) throw new Error("checkout attempt unavailable");

  const row = rpcRow(data);
  if (!row) throw new Error("checkout attempt unavailable");
  if (row.outcome === "busy" || row.outcome === "blocked") {
    return { outcome: row.outcome };
  }
  if (
    row.outcome !== "new" &&
    row.outcome !== "reclaimed" &&
    row.outcome !== "rotated" &&
    row.outcome !== "open"
  ) {
    throw new Error("checkout attempt unavailable");
  }

  const attempt = parseAttemptRow({
    user_id: args.userId,
    attempt_id: row.attempt_id,
    generation: row.generation,
    state: row.outcome === "open" ? "open" : "creating",
    stripe_customer_id: row.stripe_customer_id,
    stripe_checkout_session_id: row.stripe_checkout_session_id,
    stripe_price_id: row.stripe_price_id,
    success_url: row.success_url,
    cancel_url: row.cancel_url,
    stripe_expires_at: row.stripe_expires_at,
  });
  if (
    !attempt ||
    attempt.customerId !== args.customerId
  ) throw new Error("checkout attempt unavailable");

  if (row.outcome === "open") {
    if (!attempt.sessionId) {
      throw new Error("checkout attempt unavailable");
    }
    return { outcome: "open", ...attempt };
  }

  if (!isNonemptyString(row.lease_token) || !UUID.test(row.lease_token)) {
    throw new Error("checkout attempt unavailable");
  }
  return { outcome: row.outcome, ...attempt, leaseToken: row.lease_token };
}

export async function bindCheckoutAttempt(args: {
  attempt: CheckoutAttempt;
  leaseToken: string;
  sessionId: string;
  expiresAt: number;
  state: "open" | "completed" | "expired";
}): Promise<CheckoutAttemptBinding | null> {
  if (
    !UUID.test(args.leaseToken) ||
    !CHECKOUT_SESSION_ID.test(args.sessionId) ||
    !isPositiveInteger(args.expiresAt) ||
    args.attempt.stripeExpiresAt !== args.expiresAt
  ) return null;

  const { data, error } = await supabaseAdmin.rpc(
    "bind_subscription_checkout_session",
    {
      p_user_id: args.attempt.userId,
      p_attempt_id: args.attempt.attemptId,
      p_generation: args.attempt.generation,
      p_lease_token: args.leaseToken,
      p_stripe_customer_id: args.attempt.customerId,
      p_stripe_checkout_session_id: args.sessionId,
      p_stripe_expires_at: args.expiresAt,
      p_session_state: args.state,
    },
  );
  if (error) return null;
  const row = rpcRow(data);
  const expectedOutcome = `bound_${args.state}` as CheckoutAttemptBinding["outcome"];
  if (
    !row ||
    row.outcome !== expectedOutcome ||
    row.stripe_checkout_session_id !== args.sessionId ||
    row.stripe_expires_at !== args.expiresAt
  ) return null;
  return { outcome: expectedOutcome, state: args.state } as CheckoutAttemptBinding;
}

export async function transitionCheckoutAttempt(args: {
  attempt: CheckoutAttempt;
  targetState: "completed" | "expired" | "blocked";
  leaseToken?: string | null;
}): Promise<"transitioned" | "noop" | "stale"> {
  const { data, error } = await supabaseAdmin.rpc(
    "transition_subscription_checkout_attempt",
    {
      p_user_id: args.attempt.userId,
      p_attempt_id: args.attempt.attemptId,
      p_generation: args.attempt.generation,
      p_stripe_checkout_session_id: args.attempt.sessionId,
      p_lease_token: args.leaseToken ?? null,
      p_target_state: args.targetState,
    },
  );
  if (error) throw new Error("checkout attempt unavailable");
  const row = rpcRow(data);
  if (
    !row ||
    (row.outcome !== "transitioned" &&
      row.outcome !== "noop" &&
      row.outcome !== "stale")
  ) throw new Error("checkout attempt unavailable");
  return row.outcome;
}

export async function getCheckoutAttemptForUser(
  userId: string,
): Promise<CheckoutAttempt | null> {
  const { data, error } = await supabaseAdmin
    .from("subscription_checkout_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("checkout attempt unavailable");
  if (data === null) return null;
  const attempt = parseAttemptRow(data);
  if (!attempt || attempt.userId !== userId) {
    throw new Error("checkout attempt unavailable");
  }
  return attempt;
}

async function getOpenCheckoutAttemptForCustomer(
  customerId: string,
): Promise<CheckoutAttempt | null> {
  const { data, error } = await supabaseAdmin
    .from("subscription_checkout_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("stripe_customer_id", customerId)
    .eq("state", "open")
    .maybeSingle();
  if (error) throw new Error("checkout attempt unavailable");
  if (data === null) return null;
  const attempt = parseAttemptRow(data);
  if (
    !attempt ||
    attempt.state !== "open" ||
    attempt.customerId !== customerId
  ) throw new Error("checkout attempt unavailable");
  return attempt;
}

export function checkoutAttemptIdempotencyKey(attemptId: string): string {
  if (!UUID.test(attemptId)) throw new Error("checkout attempt unavailable");
  return `night-listener:subscription-checkout:v2:${attemptId}`;
}

export function inspectOwnedCheckoutSession(
  session: Stripe.Checkout.Session,
  attempt: CheckoutAttempt,
  nowSeconds = Math.floor(Date.now() / 1000),
): OwnedSessionInspection | null {
  if (
    !session ||
    session.id !== attempt.sessionId ||
    session.mode !== "subscription" ||
    sessionCustomerId(session.customer) !== attempt.customerId ||
    session.client_reference_id !== attempt.userId ||
    session.metadata?.userId !== attempt.userId ||
    session.metadata?.purchaseType !== "subscription" ||
    session.success_url !== attempt.successUrl ||
    session.cancel_url !== attempt.cancelUrl ||
    !isPositiveInteger(session.expires_at) ||
    !isPositiveInteger(attempt.stripeExpiresAt) ||
    session.expires_at !== attempt.stripeExpiresAt
  ) return null;

  if (session.status === "open") {
    const url = checkoutUrl(session.url);
    if (!url || session.expires_at <= nowSeconds + 5) return null;
    return { state: "open", url, expiresAt: session.expires_at };
  }
  if (session.status === "expired" || session.status === "complete") {
    return {
      state: session.status === "complete" ? "completed" : "expired",
      expiresAt: session.expires_at,
    };
  }
  return null;
}

export async function retrieveOwnedCheckoutSession(
  attempt: CheckoutAttempt,
): Promise<{ session: Stripe.Checkout.Session; inspection: OwnedSessionInspection }> {
  if (
    !attempt.sessionId ||
    !CHECKOUT_SESSION_ID.test(attempt.sessionId) ||
    !isPositiveInteger(attempt.stripeExpiresAt)
  ) {
    throw new Error("checkout attempt unavailable");
  }
  const session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
  const inspection = inspectOwnedCheckoutSession(session, attempt);
  if (!inspection) throw new Error("checkout attempt unavailable");
  return { session, inspection };
}

async function expireAttemptSession(attempt: CheckoutAttempt): Promise<void> {
  const retrieved = await retrieveOwnedCheckoutSession(attempt);
  if (retrieved.inspection.state === "completed") {
    await transitionCheckoutAttempt({ attempt, targetState: "completed" });
    return;
  }
  if (retrieved.inspection.state === "expired") {
    await transitionCheckoutAttempt({ attempt, targetState: "expired" });
    return;
  }

  const expired = await stripe.checkout.sessions.expire(attempt.sessionId!);
  const inspection = inspectOwnedCheckoutSession(expired, attempt);
  if (!inspection || inspection.state !== "expired") {
    throw new Error("checkout attempt unavailable");
  }
  const outcome = await transitionCheckoutAttempt({
    attempt,
    targetState: "expired",
  });
  if (outcome === "stale") throw new Error("checkout attempt unavailable");
}

export async function invalidateOwnedOpenAttemptForUser(
  userId: string,
  customerId: string,
): Promise<void> {
  const attempt = await getCheckoutAttemptForUser(userId);
  if (!attempt || attempt.state !== "open") return;
  if (attempt.customerId !== customerId) {
    throw new Error("checkout attempt unavailable");
  }
  await expireAttemptSession(attempt);
}

export async function invalidateOwnedOpenAttemptForCustomer(
  customerId: string,
): Promise<void> {
  const attempt = await getOpenCheckoutAttemptForCustomer(customerId);
  if (!attempt) return;
  await expireAttemptSession(attempt);
}

export async function transitionAttemptFromVerifiedSession(
  userId: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const attempt = await getCheckoutAttemptForUser(userId);
  if (!attempt || attempt.state === "blocked" || !attempt.sessionId) return;
  if (attempt.sessionId !== session.id) return;
  const inspection = inspectOwnedCheckoutSession(session, attempt);
  if (!inspection) throw new Error("checkout attempt unavailable");
  if (inspection.state === "open") return;
  await transitionCheckoutAttempt({
    attempt,
    targetState: inspection.state,
  });
}
