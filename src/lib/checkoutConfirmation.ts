export type VerificationState =
  | "verifying"
  | "verified_subscription"
  | "verified_one_time"
  | "pending"
  | "invalid"
  | "direct"
  | "failure";

export type CheckoutVerification = {
  state?: "verified" | "pending" | "failed" | "invalid";
  purchaseType?: "subscription" | "one_time";
};

export function initialVerificationState(sessionId: string | null): VerificationState {
  return sessionId ? "verifying" : "direct";
}

export function resolveVerificationState(
  responseOk: boolean,
  result: CheckoutVerification
): VerificationState {
  if (responseOk && result.state === "verified") {
    if (result.purchaseType === "subscription") return "verified_subscription";
    if (result.purchaseType === "one_time") return "verified_one_time";
  }

  if (responseOk && result.state === "pending") return "pending";
  return "invalid";
}

export function isVerifiedCheckoutState(state: VerificationState): boolean {
  return state === "verified_subscription" || state === "verified_one_time";
}
