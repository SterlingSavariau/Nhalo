import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfferStrategyCard } from "./OfferStrategyCard";

describe("OfferStrategyCard", () => {
  it("renders a deterministic market-aware posture for the selected choice", () => {
    const markup = renderToStaticMarkup(
      <OfferStrategyCard
        strategy={{
          strategyConfidence: "medium",
          offerPosture: "prepare_disciplined_offer",
          urgencyLevel: "medium",
          concessionStrategy: "limit_concession_requests",
          recommendedNextOfferAction: "draft_disciplined_offer",
          pricePosition: {
            listPrice: 385000,
            recommendedOfferPrice: 389000,
            pricePerSqft: 183,
            medianPricePerSqft: 190,
            versusList: "above_list",
            versusMarket: "discount_to_market"
          },
          marketContext: {
            listingStatus: "active",
            daysOnMarket: 12,
            comparableSampleSize: 6,
            comparableStrategyUsed: "local_radius_fallback",
            overallConfidence: "high",
            listingDataSource: "live",
            limitedComparables: false
          },
          marketRisks: ["Moderate price pressure"],
          strategyRationale: [
            "Buyer readiness supports moving forward with a disciplined offer posture."
          ],
          lastEvaluatedAt: "2026-04-03T12:00:00.000Z"
        }}
      />
    );

    expect(markup).toContain("Offer strategy");
    expect(markup).toContain("prepare disciplined offer");
    expect(markup).toContain("draft disciplined offer");
    expect(markup).toContain("limit concession requests");
    expect(markup).toContain("discount to market");
  });

  it("shows a provisional warning when the strategy confidence is low", () => {
    const markup = renderToStaticMarkup(
      <OfferStrategyCard
        compact
        strategy={{
          strategyConfidence: "low",
          offerPosture: "verify_before_offering",
          urgencyLevel: "low",
          concessionStrategy: "defer_until_more_certain",
          recommendedNextOfferAction: "review_market_inputs",
          pricePosition: {
            listPrice: 385000,
            recommendedOfferPrice: null,
            pricePerSqft: null,
            medianPricePerSqft: null,
            versusList: "unknown",
            versusMarket: "unknown"
          },
          marketContext: {
            listingStatus: null,
            daysOnMarket: null,
            comparableSampleSize: null,
            comparableStrategyUsed: null,
            overallConfidence: "low",
            listingDataSource: "stale_cached_live",
            limitedComparables: true
          },
          marketRisks: [
            "Current listing status is unavailable in the stored result.",
            "Days on market are unavailable in the stored result."
          ],
          strategyRationale: [
            "Stored market inputs are incomplete or weak, so the strategy should stay provisional."
          ],
          lastEvaluatedAt: "2026-04-03T12:00:00.000Z"
        }}
      />
    );

    expect(markup).toContain("Market inputs are incomplete or weak, so this strategy is provisional.");
    expect(markup).toContain("review market inputs");
  });
});
