export type JoinMembershipState =
  | "signed_out"
  | "checking"
  | "active"
  | "inactive"
  | "verification_error";

export type JoinMembershipView = {
  showMagicLink: boolean;
  showChecking: boolean;
  showCheckout: boolean;
  showMembersLibrary: boolean;
  showVerificationError: boolean;
};

type MemberAccessPayload = {
  ok?: unknown;
  isSubscriber?: unknown;
  membershipStatus?: unknown;
};

type MemberAccessResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type MemberAccessFetch = (
  input: string,
  init: { headers: { Authorization: string } },
) => Promise<MemberAccessResponse>;

export function getJoinMembershipView(
  state: JoinMembershipState,
): JoinMembershipView {
  return {
    showMagicLink: state === "signed_out",
    showChecking: state === "checking",
    showCheckout: state === "inactive",
    showMembersLibrary: state === "active",
    showVerificationError: state === "verification_error",
  };
}

export function parseMemberAccessState(
  responseOk: boolean,
  payload: unknown,
): "active" | "inactive" | "verification_error" {
  if (!responseOk || !payload || typeof payload !== "object") {
    return "verification_error";
  }

  const result = payload as MemberAccessPayload;
  if (
    result.ok === true &&
    result.membershipStatus === "active" &&
    result.isSubscriber === true
  ) {
    return "active";
  }
  if (
    result.ok === true &&
    result.membershipStatus === "inactive" &&
    result.isSubscriber === false
  ) {
    return "inactive";
  }
  return "verification_error";
}

export async function verifyJoinMembership(
  accessToken: string,
  request: MemberAccessFetch = fetch,
): Promise<"active" | "inactive" | "verification_error"> {
  try {
    const response = await request("/api/member-access", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return parseMemberAccessState(response.ok, await response.json());
  } catch {
    return "verification_error";
  }
}
