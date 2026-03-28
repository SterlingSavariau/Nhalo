import type {
  NegotiationGuidance,
  NegotiationRecord,
  NegotiationStatus,
  NegotiationSummary,
  OfferReadiness
} from "@nhalo/types";

type NegotiationEvaluationInput = {
  propertyId: string;
  shortlistId?: string | null;
  offerReadinessId?: string | null;
  initialOfferPrice: number;
  now: string;
  current?: NegotiationRecord | null;
  offerReadiness?: OfferReadiness | null;
  patch?: Partial<{
    status: NegotiationStatus;
    currentOfferPrice: number;
    sellerCounterPrice: number | null;
    buyerWalkAwayPrice: number | null;
    roundNumber: number;
  }>;
};

function clampPrice(value: number): number {
  return Math.max(0, Math.round(value));
}

function deriveFlags(payload: {
  status: NegotiationStatus;
  initialOfferPrice: number;
  currentOfferPrice: number;
  sellerCounterPrice: number | null;
  buyerWalkAwayPrice: number | null;
  roundNumber: number;
  offerReadiness?: OfferReadiness | null;
}): string[] {
  const flags: string[] = [];
  const recommendedOffer = payload.offerReadiness?.recommendedOfferPrice ?? null;

  if (
    payload.buyerWalkAwayPrice !== null &&
    payload.currentOfferPrice > payload.buyerWalkAwayPrice
  ) {
    flags.push("Current offer is above the walk-away threshold.");
  }

  if (
    payload.buyerWalkAwayPrice !== null &&
    payload.sellerCounterPrice !== null &&
    payload.sellerCounterPrice > payload.buyerWalkAwayPrice
  ) {
    flags.push("Seller counter is above the walk-away threshold.");
  }

  if (recommendedOffer !== null && payload.sellerCounterPrice !== null) {
    const sellerGap = Math.abs(payload.sellerCounterPrice - recommendedOffer) / Math.max(recommendedOffer, 1);
    if (sellerGap <= 0.02) {
      flags.push("Seller counter is close to the recommended offer range.");
    } else if (payload.sellerCounterPrice > recommendedOffer * 1.05) {
      flags.push("Seller counter is materially above the recommended offer range.");
    }
  }

  if (recommendedOffer !== null && payload.currentOfferPrice < recommendedOffer * 0.97) {
    flags.push("Buyer has room to negotiate before reaching the recommended offer range.");
  }

  if (payload.roundNumber >= 3) {
    flags.push("Negotiation is in a later round and should be reviewed carefully.");
  }

  if (
    payload.offerReadiness &&
    (payload.offerReadiness.status === "BLOCKED" ||
      payload.offerReadiness.blockingIssues.length > 0)
  ) {
    flags.push("Offer readiness still has blocking issues that should be cleared.");
  }

  if (payload.status === "COUNTER_RECEIVED") {
    flags.push("A seller counter is waiting for buyer review.");
  }

  return [...new Set(flags)];
}

function deriveRiskLevel(flags: string[]): NegotiationGuidance["riskLevel"] {
  if (flags.some((flag) => flag.includes("above the walk-away threshold"))) {
    return "high";
  }
  if (flags.length >= 2) {
    return "medium";
  }
  return "low";
}

function deriveHeadline(payload: {
  status: NegotiationStatus;
  riskLevel: NegotiationGuidance["riskLevel"];
  flags: string[];
  sellerCounterPrice: number | null;
  buyerWalkAwayPrice: number | null;
}): string {
  if (payload.status === "ACCEPTED") {
    return "Negotiation has been accepted and should move into the next transaction step.";
  }
  if (payload.status === "REJECTED") {
    return "Negotiation has been rejected and should be reviewed before any new action.";
  }
  if (payload.status === "WITHDRAWN") {
    return "Negotiation has been withdrawn and no further offer action should be taken.";
  }
  if (payload.status === "EXPIRED") {
    return "Negotiation expired without resolution and should be revisited before restarting.";
  }
  if (
    payload.sellerCounterPrice !== null &&
    payload.buyerWalkAwayPrice !== null &&
    payload.sellerCounterPrice > payload.buyerWalkAwayPrice
  ) {
    return "Seller counter is above the walk-away threshold and needs review before proceeding.";
  }
  if (payload.flags.some((flag) => flag.includes("room to negotiate"))) {
    return "Buyer still has room to negotiate within the current recommendation range.";
  }
  if (payload.status === "COUNTER_RECEIVED") {
    return "Seller counter has been received and is ready for buyer review.";
  }
  if (payload.riskLevel === "medium") {
    return "Negotiation is active but should be reviewed before the next move.";
  }
  return "Negotiation is progressing within the current recommendation context.";
}

function deriveNextSteps(payload: {
  status: NegotiationStatus;
  sellerCounterPrice: number | null;
  buyerWalkAwayPrice: number | null;
  flags: string[];
}): string[] {
  const steps: string[] = [];

  switch (payload.status) {
    case "NOT_STARTED":
      steps.push("Start negotiation tracking");
      steps.push("Set the initial offer");
      break;
    case "DRAFTING_OFFER":
      steps.push("Confirm the initial offer");
      steps.push("Set the walk-away threshold");
      steps.push("Submit the offer when ready");
      break;
    case "OFFER_MADE":
      steps.push("Wait for the seller response");
      steps.push("Prepare counter criteria");
      break;
    case "COUNTER_RECEIVED":
      steps.push("Review the seller counter");
      steps.push("Compare the counter to the walk-away threshold");
      steps.push("Decide whether to counter, accept, or reject");
      break;
    case "BUYER_REVIEWING":
      steps.push("Review current negotiation risks");
      steps.push("Confirm the next buyer action");
      break;
    case "COUNTER_SENT":
      steps.push("Wait for the seller response");
      steps.push("Reconfirm the walk-away threshold");
      break;
    case "ACCEPTED":
      steps.push("Capture the accepted position for the next workflow step");
      break;
    case "REJECTED":
      steps.push("Review why the offer was rejected");
      break;
    case "WITHDRAWN":
      steps.push("Document why the negotiation was withdrawn");
      break;
    case "EXPIRED":
      steps.push("Decide whether to restart with a new offer");
      break;
  }

  if (
    payload.sellerCounterPrice !== null &&
    payload.buyerWalkAwayPrice !== null &&
    payload.sellerCounterPrice > payload.buyerWalkAwayPrice
  ) {
    steps.unshift("Pause before proceeding above the walk-away threshold");
  }

  if (payload.flags.some((flag) => flag.includes("room to negotiate"))) {
    steps.push("Review whether a stronger counter still fits the buyer budget");
  }

  return [...new Set(steps)];
}

export function evaluateNegotiation(
  input: NegotiationEvaluationInput
): Omit<NegotiationRecord, "id" | "createdAt" | "updatedAt"> {
  const initialOfferPrice = clampPrice(
    input.current?.initialOfferPrice ?? input.initialOfferPrice
  );
  const currentOfferPrice = clampPrice(
    input.patch?.currentOfferPrice ??
      input.current?.currentOfferPrice ??
      initialOfferPrice
  );
  const sellerCounterPrice =
    input.patch?.sellerCounterPrice !== undefined
      ? input.patch.sellerCounterPrice
      : input.current?.sellerCounterPrice ?? null;
  const buyerWalkAwayPrice =
    input.patch?.buyerWalkAwayPrice !== undefined
      ? input.patch.buyerWalkAwayPrice
      : input.current?.buyerWalkAwayPrice ?? null;
  const roundNumber = Math.max(
    1,
    Math.round(input.patch?.roundNumber ?? input.current?.roundNumber ?? 1)
  );
  const status =
    input.patch?.status ?? input.current?.status ?? "DRAFTING_OFFER";

  const flags = deriveFlags({
    status,
    initialOfferPrice,
    currentOfferPrice,
    sellerCounterPrice,
    buyerWalkAwayPrice,
    roundNumber,
    offerReadiness: input.offerReadiness
  });
  const riskLevel = deriveRiskLevel(flags);
  const nextSteps = deriveNextSteps({
    status,
    sellerCounterPrice,
    buyerWalkAwayPrice,
    flags
  });
  const guidance: NegotiationGuidance = {
    headline: deriveHeadline({
      status,
      riskLevel,
      flags,
      sellerCounterPrice,
      buyerWalkAwayPrice
    }),
    riskLevel,
    nextSteps,
    flags
  };

  return {
    propertyId: input.propertyId,
    shortlistId: input.shortlistId ?? input.current?.shortlistId ?? null,
    offerReadinessId:
      input.offerReadinessId ?? input.current?.offerReadinessId ?? null,
    status,
    initialOfferPrice,
    currentOfferPrice,
    sellerCounterPrice,
    buyerWalkAwayPrice,
    roundNumber,
    guidance,
    lastActionAt: input.now
  };
}

export function toNegotiationSummary(
  record: NegotiationRecord
): NegotiationSummary {
  return {
    propertyId: record.propertyId,
    shortlistId: record.shortlistId ?? null,
    status: record.status,
    currentOfferPrice: record.currentOfferPrice,
    sellerCounterPrice: record.sellerCounterPrice ?? null,
    buyerWalkAwayPrice: record.buyerWalkAwayPrice ?? null,
    roundNumber: record.roundNumber,
    lastActionAt: record.lastActionAt,
    keyRisks: [...record.guidance.flags],
    nextSteps: [...record.guidance.nextSteps],
    guidance: {
      headline: record.guidance.headline,
      riskLevel: record.guidance.riskLevel,
      nextSteps: [...record.guidance.nextSteps],
      flags: [...record.guidance.flags]
    }
  };
}
