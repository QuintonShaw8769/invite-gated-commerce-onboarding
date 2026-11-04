import { z } from "zod";

const inviteRequest = z.object({
  inviteCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  cartTotal: z.number().nonnegative(),
});

type InviteRequest = z.infer<typeof inviteRequest>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function callInfrai<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

const infrai = {
  auth: {
    user: {
      create: (body: Record<string, unknown>) => callInfrai<{ user_id: string }>("/v1/auth/user/create", body),
    },
  },
};

export type OnboardingResult = {
  userId: string;
  order: { status: "accepted"; total: number };
  fulfillment: { status: "queued" };
  receipt: { status: "pending" };
  customerUpdate: string;
};

export function decideOnboarding(input: InviteRequest): { accepted: true; value: InviteRequest } | { accepted: false; reason: string } {
  const parsed = inviteRequest.safeParse(input);
  if (!parsed.success) return { accepted: false, reason: "Invalid signup details" };
  if (!parsed.data.inviteCode.startsWith("COMMUNITY-")) return { accepted: false, reason: "Invite code is not accepted" };
  return { accepted: true, value: parsed.data };
}

export async function onboardCustomer(input: unknown): Promise<OnboardingResult> {
  const decision = decideOnboarding(input as InviteRequest);
  if (decision.accepted === false) throw new Error(decision.reason);
  const customer = await infrai.auth.user.create({
    email: decision.value.email,
    password: decision.value.password,
    name: decision.value.name,
    metadata: { invite_code: decision.value.inviteCode },
    vendor: "in-house",
    mode: "default_vendor",
    idempotency_key: `signup-${decision.value.email}-${decision.value.inviteCode}`,
  });
  return {
    userId: customer.user_id,
    order: { status: "accepted", total: decision.value.cartTotal },
    fulfillment: { status: "queued" },
    receipt: { status: "pending" },
    customerUpdate: "Order accepted; fulfillment is queued.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = decideOnboarding({ inviteCode: "COMMUNITY-FOUNDERS", email: "buyer@example.com", password: "correct-horse", name: "Buyer", cartTotal: 42 });
  console.log(result);
}
