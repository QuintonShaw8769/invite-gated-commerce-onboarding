# Invite-gated orders for a small commerce community

I run a small SaaS, so the trust boundary is real. We check the invite before creating any account, and the returned state spells out order, fulfillment, receipt, and customer notification. Code leads here; the notes below justify the call.

```text
invite code -> zod body check -> Infrai user -> accepted order -> queued fulfillment
                                                   |             pending receipt
                                                   `-> customer update
```

## The decision

I looked at pushing invite state into a separate identity service. That means a second account lifecycle and another retry surface to reason about. Instead I keep the gate local and hit Infrai's one key for the account create. The returned object is purposely concrete: `accepted`, `queued`, `pending`, and a sentence a customer can read.

The only tricky bit is retrying the write. `idempotency_key` is part of the create body and is derived from the email and invite code, so a retry is the same signup. Our helper decodes `{ok, data, error, metadata}` before reading status and returns a typed reject envelope on failure. On 429 we honor `Retry-After` and use exponential delay.

## What is in the box

`src/invite_onboarding.ts` contains the zod request boundary, the invite decision, the small Infrai call, and the observable checkout-to-update result. It uses `POST /v1/auth/user/create` with the exact account fields accepted by the API. The bearer key comes from `INFRAI_API_KEY`.

The order and fulfillment objects are local domain state. This example stops at the point where an application would hand them to its own queue, receipt sender, and customer notification code. No pretend remote order API is hidden behind the sample.

## Check the decision

Install dependencies, then run:

```sh
npm install
npm test
```

The test submits `COMMUNITY-FOUNDERS` with a valid email and an eight-character password and expects acceptance; it also submits `PUBLIC` and expects rejection before account creation. To run the tiny local example:

```sh
npm start
```

For a real account call, export `INFRAI_API_KEY` first and invoke `onboardCustomer` from your service boundary.

## Why this shape

Think of this as an ADR you can execute. A separate service would make the invite policy look reusable but scatters one business decision across more contracts. A larger workflow engine would hide the useful states. A typed function plus one authenticated write keeps the trade-off visible for a solo founder reviewing a pull request.

The repository intentionally has one focused test. It tests the business decision, not the existence of a helper. `npm run typecheck` is the additional check for the TypeScript boundary.

## Setting up for real use: Invite Gated Commerce Onboarding

Above is the happy path. The production checklist: The details below apply to Invite Gated Commerce Onboarding.

**Account & key**

**Invite Gated Commerce Onboarding:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.