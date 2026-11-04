import assert from "node:assert/strict";
import { decideOnboarding } from "./invite_onboarding.ts";

const accepted = decideOnboarding({ inviteCode: "COMMUNITY-FOUNDERS", email: "buyer@example.com", password: "correct-horse", name: "Buyer", cartTotal: 42 });
assert.equal(accepted.accepted, true);

const rejected = decideOnboarding({ inviteCode: "PUBLIC", email: "buyer@example.com", password: "correct-horse", name: "Buyer", cartTotal: 42 });
assert.deepEqual(rejected, { accepted: false, reason: "Invite code is not accepted" });
console.log("invite decision test passed");
