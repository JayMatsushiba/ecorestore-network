/**
 * Ecorestore Network — M5 Subgraph Mapping Tests (matchstick-as)
 *
 * Fast, deterministic unit tests for subgraph/src/mapping.ts, run without
 * Docker/Graph Node/Postgres/IPFS (Matchstick simulates the graph-node
 * runtime in-process). These do NOT replace the Graph Node integration
 * test (docs/GRAPH.md, npm run test:e2e:graph) — they verify entity/field
 * mapping logic in isolation. Run via `npm run test:graph` (invokes
 * `graph test --docker`, since matchstick-as ships no native Windows
 * binary — see docs/GRAPH.md "Windows/Docker note").
 */

import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, newTypedMockEventWithParams, test } from "matchstick-as/assembly/index";
import {
  handleDeedCancelled,
  handleDeedCreated,
  handleDeedFunded,
  handleRefundExecuted,
  handleSettlementExecuted,
  handleVerificationSubmitted,
} from "../src/mapping";
import {
  DeedCancelled,
  DeedCreated,
  DeedFunded,
  RefundExecuted,
  SettlementExecuted,
  VerificationSubmitted,
} from "../generated/RestorationDeed/RestorationDeed";

const CONTRACT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const DEED_ID = BigInt.fromI32(0);
const PROJECT_ID = Bytes.fromHexString("0x1111111111111111111111111111111111111111111111111111111111111a");
const PARCEL_H3_ROOT = Bytes.fromHexString("0x2222222222222222222222222222222222222222222222222222222222222b");
const SPONSOR = Address.fromString("0x0000000000000000000000000000000000000002");
const BENEFICIARY = Address.fromString("0x0000000000000000000000000000000000000003");
const VERIFIER = Address.fromString("0x0000000000000000000000000000000000000004");
const VERIFICATION_ID = Bytes.fromHexString(
  "0x4444444444444444444444444444444444444444444444444444444444444d",
);

function createDeedCreatedEvent(): DeedCreated {
  let event = newTypedMockEventWithParams<DeedCreated>([
    new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
    new ethereum.EventParam("projectId", ethereum.Value.fromBytes(PROJECT_ID)),
    new ethereum.EventParam("parcelH3Root", ethereum.Value.fromBytes(PARCEL_H3_ROOT)),
    new ethereum.EventParam("sponsor", ethereum.Value.fromAddress(SPONSOR)),
    new ethereum.EventParam("beneficiary", ethereum.Value.fromAddress(BENEFICIARY)),
    new ethereum.EventParam("authorizedVerifier", ethereum.Value.fromAddress(VERIFIER)),
    new ethereum.EventParam("escrowAmount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000))),
    new ethereum.EventParam("unitPriceUSDC", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000_000))),
    new ethereum.EventParam("quantityDecimals", ethereum.Value.fromI32(6)),
  ]);
  event.address = CONTRACT_ADDRESS;
  return event;
}

function seedDeed(): void {
  handleDeedCreated(createDeedCreatedEvent());
}

describe("handleDeedCreated", () => {
  afterEach(() => {
    clearStore();
  });

  test("creates a RestorationDeed entity with fields from the event, status CREATED", () => {
    seedDeed();

    assert.entityCount("RestorationDeed", 1);
    assert.fieldEquals("RestorationDeed", "0", "status", "CREATED");
    assert.fieldEquals("RestorationDeed", "0", "sponsor", SPONSOR.toHexString());
    assert.fieldEquals("RestorationDeed", "0", "beneficiary", BENEFICIARY.toHexString());
    assert.fieldEquals("RestorationDeed", "0", "authorizedVerifier", VERIFIER.toHexString());
    assert.fieldEquals("RestorationDeed", "0", "escrowAmount", "100000000");
    assert.fieldEquals("RestorationDeed", "0", "unitPriceUSDC", "1000000");
    assert.fieldEquals("RestorationDeed", "0", "quantityDecimals", "6");
    assert.fieldEquals("RestorationDeed", "0", "fundedAmount", "0");
  });

  test("creates a Project entity keyed by projectId", () => {
    seedDeed();
    assert.entityCount("Project", 1);
    assert.fieldEquals("Project", PROJECT_ID.toHexString(), "parcelH3Root", PARCEL_H3_ROOT.toHexString());
  });

  test("a second deed under the same projectId reuses the existing Project entity", () => {
    seedDeed();

    let secondDeedEvent = newTypedMockEventWithParams<DeedCreated>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam("projectId", ethereum.Value.fromBytes(PROJECT_ID)),
      new ethereum.EventParam("parcelH3Root", ethereum.Value.fromBytes(PARCEL_H3_ROOT)),
      new ethereum.EventParam("sponsor", ethereum.Value.fromAddress(SPONSOR)),
      new ethereum.EventParam("beneficiary", ethereum.Value.fromAddress(BENEFICIARY)),
      new ethereum.EventParam("authorizedVerifier", ethereum.Value.fromAddress(VERIFIER)),
      new ethereum.EventParam("escrowAmount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000))),
      new ethereum.EventParam("unitPriceUSDC", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000_000))),
      new ethereum.EventParam("quantityDecimals", ethereum.Value.fromI32(6)),
    ]);
    secondDeedEvent.address = CONTRACT_ADDRESS;
    handleDeedCreated(secondDeedEvent);

    assert.entityCount("Project", 1);
    assert.entityCount("RestorationDeed", 2);
  });
});

describe("handleDeedFunded", () => {
  afterEach(() => {
    clearStore();
  });

  test("sets fundedAmount and status FUNDED, and records a Funding entity", () => {
    seedDeed();

    let event = newTypedMockEventWithParams<DeedFunded>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("sponsor", ethereum.Value.fromAddress(SPONSOR)),
      new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000))),
    ]);
    handleDeedFunded(event);

    assert.fieldEquals("RestorationDeed", "0", "status", "FUNDED");
    assert.fieldEquals("RestorationDeed", "0", "fundedAmount", "100000000");
    assert.entityCount("Funding", 1);
  });
});

describe("handleDeedCancelled", () => {
  afterEach(() => {
    clearStore();
  });

  test("sets status CANCELLED and records a Cancellation entity", () => {
    seedDeed();

    let event = newTypedMockEventWithParams<DeedCancelled>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
    ]);
    handleDeedCancelled(event);

    assert.fieldEquals("RestorationDeed", "0", "status", "CANCELLED");
    assert.entityCount("Cancellation", 1);
  });
});

describe("handleVerificationSubmitted", () => {
  afterEach(() => {
    clearStore();
  });

  test("financiallyEligible=true moves the deed to VERIFIED and records the settled quantity", () => {
    seedDeed();

    let event = newTypedMockEventWithParams<VerificationSubmitted>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("verificationId", ethereum.Value.fromBytes(VERIFICATION_ID)),
      new ethereum.EventParam("financiallyEligible", ethereum.Value.fromBoolean(true)),
      new ethereum.EventParam("settledQuantityScaled", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18_181_500))),
      new ethereum.EventParam("settlementAmount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18_181_500))),
    ]);
    handleVerificationSubmitted(event);

    assert.fieldEquals("RestorationDeed", "0", "status", "VERIFIED");
    assert.fieldEquals("RestorationDeed", "0", "settledQuantityScaled", "18181500");
    assert.fieldEquals("RestorationDeed", "0", "settlementAmount", "18181500");
    assert.fieldEquals("RestorationDeed", "0", "verificationId", VERIFICATION_ID.toHexString());

    assert.entityCount("Verification", 1);
    assert.fieldEquals("Verification", VERIFICATION_ID.toHexString(), "financiallyEligible", "true");
    assert.fieldEquals("Verification", VERIFICATION_ID.toHexString(), "deed", "0");
  });

  test("financiallyEligible=false moves the deed to FAILED without recording a settlement amount", () => {
    seedDeed();

    let event = newTypedMockEventWithParams<VerificationSubmitted>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("verificationId", ethereum.Value.fromBytes(VERIFICATION_ID)),
      new ethereum.EventParam("financiallyEligible", ethereum.Value.fromBoolean(false)),
      new ethereum.EventParam("settledQuantityScaled", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
      new ethereum.EventParam("settlementAmount", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
    ]);
    handleVerificationSubmitted(event);

    assert.fieldEquals("RestorationDeed", "0", "status", "FAILED");
    // An ineligible verification never sets these — they remain unset from DeedCreated.
    assert.fieldEquals("RestorationDeed", "0", "settledQuantityScaled", "null");
    assert.fieldEquals("RestorationDeed", "0", "settlementAmount", "null");
  });
});

describe("handleSettlementExecuted", () => {
  afterEach(() => {
    clearStore();
  });

  test("sets status SETTLED, records releasedAmount, and creates a Settlement linked to the Verification", () => {
    seedDeed();

    let verifiedEvent = newTypedMockEventWithParams<VerificationSubmitted>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("verificationId", ethereum.Value.fromBytes(VERIFICATION_ID)),
      new ethereum.EventParam("financiallyEligible", ethereum.Value.fromBoolean(true)),
      new ethereum.EventParam("settledQuantityScaled", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18_181_500))),
      new ethereum.EventParam("settlementAmount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18_181_500))),
    ]);
    handleVerificationSubmitted(verifiedEvent);

    let settlementEvent = newTypedMockEventWithParams<SettlementExecuted>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("verificationId", ethereum.Value.fromBytes(VERIFICATION_ID)),
      new ethereum.EventParam("beneficiary", ethereum.Value.fromAddress(BENEFICIARY)),
      new ethereum.EventParam("settlementAmount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18_181_500))),
      new ethereum.EventParam("refundedRemainder", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(81_818_500))),
    ]);
    handleSettlementExecuted(settlementEvent);

    assert.fieldEquals("RestorationDeed", "0", "status", "SETTLED");
    assert.fieldEquals("RestorationDeed", "0", "releasedAmount", "18181500");
    assert.entityCount("Settlement", 1);
    assert.fieldEquals(
      "Settlement",
      settlementEvent.transaction.hash.concatI32(settlementEvent.logIndex.toI32()).toHexString(),
      "verification",
      VERIFICATION_ID.toHexString(),
    );
    assert.fieldEquals(
      "Settlement",
      settlementEvent.transaction.hash.concatI32(settlementEvent.logIndex.toI32()).toHexString(),
      "refundedRemainder",
      "81818500",
    );
  });
});

describe("handleRefundExecuted", () => {
  afterEach(() => {
    clearStore();
  });

  test("sets status REFUNDED and records a Refund entity", () => {
    seedDeed();

    let event = newTypedMockEventWithParams<RefundExecuted>([
      new ethereum.EventParam("deedId", ethereum.Value.fromUnsignedBigInt(DEED_ID)),
      new ethereum.EventParam("sponsor", ethereum.Value.fromAddress(SPONSOR)),
      new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000))),
    ]);
    handleRefundExecuted(event);

    assert.fieldEquals("RestorationDeed", "0", "status", "REFUNDED");
    assert.entityCount("Refund", 1);
  });
});
