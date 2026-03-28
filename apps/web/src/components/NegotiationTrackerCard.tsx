import { useEffect, useState } from "react";
import type {
  NegotiationEvent,
  NegotiationRecord,
  NegotiationStatus,
  OfferReadiness,
  ShortlistItem
} from "@nhalo/types";
import { NEGOTIATION_COPY } from "../content";

interface NegotiationTrackerCardProps {
  item: ShortlistItem;
  offerReadiness?: OfferReadiness | null;
  negotiation?: NegotiationRecord | null;
  events?: NegotiationEvent[];
  onCreate(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationStatus;
    initialOfferPrice: number;
    currentOfferPrice?: number;
    buyerWalkAwayPrice?: number | null;
  }): Promise<void> | void;
  onUpdate(
    id: string,
    patch: {
      status?: NegotiationStatus;
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<void> | void;
  onAddEvent(
    negotiationId: string,
    payload: {
      type: NegotiationEvent["type"];
      label: string;
      details?: string | null;
    }
  ): Promise<void> | void;
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not set";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function parseOptionalCurrency(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

export function NegotiationTrackerCard({
  item,
  offerReadiness,
  negotiation,
  events = [],
  onCreate,
  onUpdate,
  onAddEvent
}: NegotiationTrackerCardProps) {
  const [status, setStatus] = useState<NegotiationStatus>("DRAFTING_OFFER");
  const [initialOfferPrice, setInitialOfferPrice] = useState("");
  const [currentOfferPrice, setCurrentOfferPrice] = useState("");
  const [sellerCounterPrice, setSellerCounterPrice] = useState("");
  const [buyerWalkAwayPrice, setBuyerWalkAwayPrice] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [timelineNote, setTimelineNote] = useState("");

  useEffect(() => {
    const recommended = offerReadiness?.recommendedOfferPrice ?? item.capturedHome.price;
    setStatus(negotiation?.status ?? "DRAFTING_OFFER");
    setInitialOfferPrice(String(negotiation?.initialOfferPrice ?? recommended));
    setCurrentOfferPrice(String(negotiation?.currentOfferPrice ?? recommended));
    setSellerCounterPrice(
      negotiation?.sellerCounterPrice ? String(negotiation.sellerCounterPrice) : ""
    );
    setBuyerWalkAwayPrice(
      negotiation?.buyerWalkAwayPrice ? String(negotiation.buyerWalkAwayPrice) : ""
    );
    setRoundNumber(String(negotiation?.roundNumber ?? 1));
  }, [item.capturedHome.price, negotiation, offerReadiness?.recommendedOfferPrice]);

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{NEGOTIATION_COPY.title}</p>
          <strong>
            {negotiation ? negotiation.status.replaceAll("_", " ").toLowerCase() : "not started"}
          </strong>
          <p className="muted">{NEGOTIATION_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          {negotiation ? (
            <>
              <span className="status-chip">
                {NEGOTIATION_COPY.roundLabel}: {negotiation.roundNumber}
              </span>
              <span className="status-chip">{negotiation.guidance.riskLevel} risk</span>
            </>
          ) : (
            <span className="status-chip">No negotiation record yet</span>
          )}
        </div>
      </div>

      {negotiation ? (
        <>
          <div className="summary-grid">
            <div className="summary-block">
              <h3>{NEGOTIATION_COPY.guidanceTitle}</h3>
              <p>{negotiation.guidance.headline}</p>
              <p className="muted">
                Last action {new Date(negotiation.lastActionAt).toLocaleString()}
              </p>
            </div>
            <div className="summary-block">
              <h3>{NEGOTIATION_COPY.flagsTitle}</h3>
              <ul>
                {(negotiation.guidance.flags.length > 0
                  ? negotiation.guidance.flags
                  : ["No negotiation flags are currently stored."]).map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-block">
              <h3>Offer position</h3>
              <p>Initial {formatCurrency(negotiation.initialOfferPrice)}</p>
              <p>Current {formatCurrency(negotiation.currentOfferPrice)}</p>
              <p>Seller counter {formatCurrency(negotiation.sellerCounterPrice)}</p>
              <p>Walk-away {formatCurrency(negotiation.buyerWalkAwayPrice)}</p>
            </div>
            <div className="summary-block">
              <h3>{NEGOTIATION_COPY.nextStepsTitle}</h3>
              <ul>
                {negotiation.guidance.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}

      <div className="offer-readiness-grid">
        <label>
          <span>Initial offer</span>
          <input
            inputMode="numeric"
            onChange={(event) => setInitialOfferPrice(event.target.value)}
            value={initialOfferPrice}
          />
        </label>
        <label>
          <span>{NEGOTIATION_COPY.currentOfferLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setCurrentOfferPrice(event.target.value)}
            value={currentOfferPrice}
          />
        </label>
        <label>
          <span>{NEGOTIATION_COPY.sellerCounterLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setSellerCounterPrice(event.target.value)}
            value={sellerCounterPrice}
          />
        </label>
        <label>
          <span>{NEGOTIATION_COPY.walkAwayLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setBuyerWalkAwayPrice(event.target.value)}
            value={buyerWalkAwayPrice}
          />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as NegotiationStatus)}>
            <option value="NOT_STARTED">Not started</option>
            <option value="DRAFTING_OFFER">Drafting offer</option>
            <option value="OFFER_MADE">Offer made</option>
            <option value="COUNTER_RECEIVED">Counter received</option>
            <option value="BUYER_REVIEWING">Buyer reviewing</option>
            <option value="COUNTER_SENT">Counter sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </label>
        <label>
          <span>{NEGOTIATION_COPY.roundLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setRoundNumber(event.target.value)}
            value={roundNumber}
          />
        </label>
      </div>

      <div className="activity-actions">
        {negotiation ? (
          <>
            <button
              className="chip"
              onClick={() =>
                onUpdate(negotiation.id, {
                  status,
                  currentOfferPrice: parseOptionalCurrency(currentOfferPrice) ?? negotiation.currentOfferPrice,
                  sellerCounterPrice: parseOptionalCurrency(sellerCounterPrice),
                  buyerWalkAwayPrice: parseOptionalCurrency(buyerWalkAwayPrice),
                  roundNumber: Math.max(1, Number(roundNumber) || 1)
                })
              }
              type="button"
            >
              {NEGOTIATION_COPY.updateAction}
            </button>
            <button
              className="chip"
              onClick={async () => {
                await onUpdate(negotiation.id, {
                  status: "OFFER_MADE",
                  currentOfferPrice: parseOptionalCurrency(currentOfferPrice) ?? negotiation.currentOfferPrice
                });
                await onAddEvent(negotiation.id, {
                  type: "OFFER_SUBMITTED",
                  label: "Offer submitted",
                  details: `Buyer offer submitted at ${formatCurrency(
                    parseOptionalCurrency(currentOfferPrice) ?? negotiation.currentOfferPrice
                  )}.`
                });
              }}
              type="button"
            >
              Mark offer made
            </button>
            <button
              className="chip"
              onClick={async () => {
                await onUpdate(negotiation.id, {
                  status: "COUNTER_RECEIVED",
                  sellerCounterPrice: parseOptionalCurrency(sellerCounterPrice),
                  roundNumber: Math.max(1, Number(roundNumber) || negotiation.roundNumber)
                });
                await onAddEvent(negotiation.id, {
                  type: "SELLER_COUNTER_RECEIVED",
                  label: "Seller counter received",
                  details: sellerCounterPrice
                    ? `Seller counter recorded at ${formatCurrency(parseOptionalCurrency(sellerCounterPrice))}.`
                    : null
                });
              }}
              type="button"
            >
              Record seller counter
            </button>
            <button
              className="chip"
              onClick={async () => {
                await onUpdate(negotiation.id, {
                  status: "COUNTER_SENT",
                  currentOfferPrice: parseOptionalCurrency(currentOfferPrice) ?? negotiation.currentOfferPrice,
                  roundNumber: Math.max(1, Number(roundNumber) || negotiation.roundNumber)
                });
                await onAddEvent(negotiation.id, {
                  type: "BUYER_COUNTER_SENT",
                  label: "Buyer counter sent",
                  details: `Buyer counter sent at ${formatCurrency(
                    parseOptionalCurrency(currentOfferPrice) ?? negotiation.currentOfferPrice
                  )}.`
                });
              }}
              type="button"
            >
              Record buyer counter
            </button>
          </>
        ) : (
          <button
            className="chip"
            onClick={() =>
              onCreate({
                propertyId: item.canonicalPropertyId,
                shortlistId: item.shortlistId,
                offerReadinessId: offerReadiness?.id ?? null,
                status,
                initialOfferPrice:
                  parseOptionalCurrency(initialOfferPrice) ??
                  offerReadiness?.recommendedOfferPrice ??
                  item.capturedHome.price,
                currentOfferPrice:
                  parseOptionalCurrency(currentOfferPrice) ??
                  offerReadiness?.recommendedOfferPrice ??
                  item.capturedHome.price,
                buyerWalkAwayPrice: parseOptionalCurrency(buyerWalkAwayPrice)
              })
            }
            type="button"
          >
            {NEGOTIATION_COPY.startAction}
          </button>
        )}
      </div>

      {negotiation ? (
        <>
          <label>
            <span>Timeline note</span>
            <textarea
              placeholder="Add a short note about the latest negotiation move."
              value={timelineNote}
              onChange={(event) => setTimelineNote(event.target.value)}
            />
          </label>
          <div className="activity-actions">
            <button
              className="chip"
              disabled={!timelineNote.trim()}
              onClick={async () => {
                await onAddEvent(negotiation.id, {
                  type: "NOTE_ADDED",
                  label: "Negotiation note added",
                  details: timelineNote.trim()
                });
                setTimelineNote("");
              }}
              type="button"
            >
              {NEGOTIATION_COPY.addEventAction}
            </button>
          </div>

          <div className="summary-block">
            <h3>{NEGOTIATION_COPY.timelineTitle}</h3>
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong> · {new Date(event.createdAt).toLocaleString()}
                  {event.details ? ` · ${event.details}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <p className="muted">{NEGOTIATION_COPY.summaryWarning}</p>
    </div>
  );
}
