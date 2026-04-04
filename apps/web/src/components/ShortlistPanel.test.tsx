import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ShortlistPanel } from "./ShortlistPanel";

describe("ShortlistPanel", () => {
  it("renders shortlist workflow content for saved homes and notes", () => {
    const markup = renderToStaticMarkup(
      <ShortlistPanel
        financialReadiness={{
          id: "financial-1",
          sessionId: "session-1",
          partnerId: null,
          annualHouseholdIncome: 185000,
          monthlyDebtPayments: 900,
          availableCashSavings: 95000,
          creditScoreRange: "good_720_759",
          desiredHomePrice: 589000,
          purchaseLocation: "Royal Oak, MI",
          downPaymentPreferencePercent: 10,
          loanType: "conventional",
          preApprovalStatus: "verified",
          preApprovalExpiresAt: null,
          proofOfFundsStatus: "verified",
          maxAffordableHomePrice: 598000,
          estimatedMonthlyPayment: 3920,
          estimatedDownPayment: 58900,
          estimatedClosingCosts: 17670,
          totalCashRequiredToClose: 76570,
          debtToIncomeRatio: 0.33,
          housingRatio: 0.26,
          affordabilityClassification: "READY",
          readinessState: "READY",
          blockers: [],
          recommendation: "You are ready to proceed.",
          risk: "Normal affordability risk.",
          alternative: "Lower the target price for a wider buffer.",
          nextAction: "Proceed to offer preparation",
          nextSteps: ["Proceed to offer preparation"],
          assumptionsUsed: {
            interestRate: 0.066,
            propertyTaxRate: 0.0125,
            insuranceMonthly: 179,
            closingCostPercent: 0.03,
            downPaymentPercent: 0.1,
            loanType: "conventional"
          },
          lastEvaluatedAt: "2026-04-01T20:00:00.000Z",
          createdAt: "2026-04-01T20:00:00.000Z",
          updatedAt: "2026-04-01T20:00:00.000Z"
        }}
        historicalCompareEnabled
        items={[
          {
            id: "item-1",
            shortlistId: "shortlist-1",
            canonicalPropertyId: "canonical-1",
            sourceSnapshotId: "snapshot-1",
            sourceHistoryId: null,
            sourceSearchDefinitionId: null,
            reviewState: "undecided",
            choiceStatus: "selected",
            selectionRank: 1,
            decisionConfidence: "high",
            decisionRationale: "Best overall fit for the household.",
            decisionRisks: [],
            lastDecisionReviewedAt: "2026-03-24T12:00:00.000Z",
            selectedAt: "2026-03-24T12:00:00.000Z",
            statusChangedAt: "2026-03-24T12:00:00.000Z",
            replacedByShortlistItemId: null,
            droppedReason: null,
            addedAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z",
            capturedHome: {
              id: "home-1",
              address: "123 Main St",
              city: "Southfield",
              state: "MI",
              zipCode: "48075",
              propertyType: "single_family",
              price: 385000,
              sqft: 2100,
              bedrooms: 4,
              bathrooms: 3,
              canonicalPropertyId: "canonical-1",
              distanceMiles: 2.1,
              insideRequestedRadius: true,
              qualityFlags: [],
              strengths: [],
              risks: [],
              confidenceReasons: [],
              explainability: {
                headline: "Strong family fit",
                strengths: [],
                risks: [],
                scoreDrivers: {
                  primary: "safety",
                  secondary: "size",
                  weakest: "price"
                }
              },
              provenance: {
                listingDataSource: "live",
                listingProvider: "ListingProvider",
                listingFetchedAt: null,
                sourceListingId: "src-1",
                safetyDataSource: "cached_live",
                crimeProvider: "CrimeProvider",
                schoolProvider: "SchoolProvider",
                crimeFetchedAt: null,
                schoolFetchedAt: null,
                geocodeDataSource: "live",
                geocodeProvider: "GeocoderProvider",
                geocodeFetchedAt: null,
                geocodePrecision: "rooftop"
              },
              neighborhoodSafetyScore: 84,
              explanation: "Strong family fit",
              scores: {
                price: 71,
                size: 78,
                safety: 84,
                nhalo: 77,
                safetyConfidence: "high",
                overallConfidence: "high",
                formulaVersion: "nhalo-v1"
              }
            }
          },
          {
            id: "item-2",
            shortlistId: "shortlist-1",
            canonicalPropertyId: "canonical-2",
            sourceSnapshotId: "snapshot-1",
            sourceHistoryId: null,
            sourceSearchDefinitionId: null,
            reviewState: "interested",
            choiceStatus: "backup",
            selectionRank: 2,
            decisionConfidence: "medium",
            decisionRationale: "Keep this as the first fallback if pricing softens.",
            decisionRisks: [],
            lastDecisionReviewedAt: "2026-03-24T12:00:00.000Z",
            selectedAt: null,
            statusChangedAt: "2026-03-24T12:00:00.000Z",
            replacedByShortlistItemId: null,
            droppedReason: null,
            addedAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z",
            capturedHome: {
              id: "home-2",
              address: "456 Backup Ave",
              city: "Southfield",
              state: "MI",
              zipCode: "48075",
              propertyType: "single_family",
              price: 372000,
              sqft: 2050,
              bedrooms: 4,
              bathrooms: 2.5,
              canonicalPropertyId: "canonical-2",
              distanceMiles: 2.8,
              insideRequestedRadius: true,
              qualityFlags: [],
              strengths: [],
              risks: [],
              confidenceReasons: [],
              explainability: {
                headline: "Slightly cheaper fallback option",
                strengths: [],
                risks: [],
                scoreDrivers: {
                  primary: "price",
                  secondary: "size",
                  weakest: "safety"
                }
              },
              provenance: {
                listingDataSource: "live",
                listingProvider: "ListingProvider",
                listingFetchedAt: null,
                sourceListingId: "src-2",
                safetyDataSource: "cached_live",
                crimeProvider: "CrimeProvider",
                schoolProvider: "SchoolProvider",
                crimeFetchedAt: null,
                schoolFetchedAt: null,
                geocodeDataSource: "live",
                geocodeProvider: "GeocoderProvider",
                geocodeFetchedAt: null,
                geocodePrecision: "rooftop"
              },
              neighborhoodSafetyScore: 80,
              explanation: "Slightly cheaper fallback option",
              scores: {
                price: 75,
                size: 76,
                safety: 80,
                nhalo: 75,
                safetyConfidence: "high",
                overallConfidence: "high",
                formulaVersion: "nhalo-v1"
              }
            }
          }
        ]}
        offerPreparations={[
          {
            id: "offer-prep-1",
            sessionId: "session-1",
            partnerId: null,
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Southfield, MI",
            shortlistId: "shortlist-1",
            offerReadinessId: "offer-1",
            financialReadinessId: "financial-1",
            offerPrice: 389000,
            earnestMoneyAmount: 4000,
            downPaymentType: "percent",
            downPaymentAmount: 38900,
            downPaymentPercent: 10,
            financingContingency: "included",
            inspectionContingency: "included",
            appraisalContingency: "included",
            closingTimelineDays: 30,
            possessionTiming: "at_closing",
            possessionDaysAfterClosing: null,
            sellerConcessionsRequestedAmount: null,
            notes: "Strong candidate.",
            buyerRationale: "Comfortable fit for the household.",
            offerSummary: {
              propertyId: "canonical-1",
              propertyAddressLabel: "123 Main St, Southfield, MI",
              offerPrice: 389000,
              earnestMoneyAmount: 4000,
              downPaymentAmount: 38900,
              downPaymentPercent: 10,
              financingContingency: "included",
              inspectionContingency: "included",
              appraisalContingency: "included",
              closingTimelineDays: 30,
              possessionTiming: "at_closing"
            },
            offerState: "READY",
            offerRiskLevel: "LOW_RISK",
            offerCompletenessState: "complete",
            readinessToSubmit: true,
            cashRequiredAtOffer: 50570,
            missingItems: [],
            blockers: [],
            recommendation: "This offer draft is complete and financially supported.",
            risk: "The current terms stay inside the normal risk band for this workflow.",
            alternative: "Keep the draft aligned with financial readiness and move to submission when ready.",
            nextAction: "Proceed to offer submission",
            nextSteps: ["Proceed to offer submission"],
            financialAlignment: {
              maxAffordableHomePrice: 598000,
              targetCashToClose: 76570,
              availableCashSavings: 95000,
              affordabilityClassification: "READY",
              readinessState: "READY",
              financiallyAligned: true,
              recommendedOfferPrice: 389000
            },
            assumptionsUsed: {
              lowEarnestMoneyPercent: 0.01,
              standardEarnestMoneyPercent: { min: 0.01, max: 0.03 },
              aggressiveClosingTimelineDays: 14,
              slowClosingTimelineDays: 45,
              affordabilityTolerancePercent: 0.05
            },
            lastEvaluatedAt: "2026-03-24T12:06:00.000Z",
            createdAt: "2026-03-24T12:06:00.000Z",
            updatedAt: "2026-03-24T12:06:00.000Z"
          }
        ]}
        offerSubmissions={[
          {
            id: "offer-submission-1",
            sessionId: "session-1",
            partnerId: null,
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Southfield, MI",
            shortlistId: "shortlist-1",
            financialReadinessId: "financial-1",
            offerPreparationId: "offer-prep-1",
            submissionMethod: "recorded_manual",
            submittedAt: "2026-03-24T12:12:00.000Z",
            offerExpirationAt: "2026-03-26T12:12:00.000Z",
            sellerResponseState: "COUNTERED",
            sellerRespondedAt: "2026-03-25T09:00:00.000Z",
            buyerCounterDecision: "pending",
            withdrawnAt: null,
            withdrawalReason: null,
            counterofferPrice: 395000,
            counterofferClosingTimelineDays: 21,
            counterofferFinancingContingency: "included",
            counterofferInspectionContingency: "included",
            counterofferAppraisalContingency: "waived",
            counterofferExpirationAt: "2026-03-26T17:00:00.000Z",
            notes: "Seller wants a faster close.",
            internalActivityNote: null,
            originalOfferSnapshot: {
              offerPrice: 389000,
              earnestMoneyAmount: 4000,
              downPaymentAmount: 38900,
              downPaymentPercent: 10,
              financingContingency: "included",
              inspectionContingency: "included",
              appraisalContingency: "included",
              closingTimelineDays: 30
            },
            submissionSummary: {
              propertyId: "canonical-1",
              propertyAddressLabel: "123 Main St, Southfield, MI",
              offerPreparationId: "offer-prep-1",
              submittedAt: "2026-03-24T12:12:00.000Z",
              offerExpirationAt: "2026-03-26T12:12:00.000Z",
              currentOfferPrice: 395000,
              earnestMoneyAmount: 4000,
              closingTimelineDays: 21
            },
            submissionState: "COUNTERED",
            urgencyLevel: "MODERATE_URGENCY",
            counterofferSummary: {
              present: true,
              counterofferPrice: 395000,
              counterofferClosingTimelineDays: 21,
              counterofferFinancingContingency: "included",
              counterofferInspectionContingency: "included",
              counterofferAppraisalContingency: "waived",
              counterofferExpirationAt: "2026-03-26T17:00:00.000Z",
              changedFields: ["price", "closingTimelineDays", "appraisalContingency"]
            },
            missingItems: [],
            blockers: [],
            recommendation: "The seller responded with changed terms that need buyer review.",
            risk: "Changed price, timing, or contingencies could shift the buyer's risk profile.",
            alternative: "The buyer can reject the counter or revise the offer instead of accepting.",
            nextAction: "Review counteroffer",
            nextSteps: ["Review counteroffer", "Revise offer terms", "Reject counteroffer"],
            requiresBuyerResponse: true,
            isExpired: false,
            lastActionAt: "2026-03-25T09:00:00.000Z",
            lastEvaluatedAt: "2026-03-25T09:00:00.000Z",
            activityLog: [
              {
                type: "record_created",
                label: "Submission record created",
                details: null,
                createdAt: "2026-03-24T12:06:00.000Z"
              },
              {
                type: "offer_submitted",
                label: "Offer submitted",
                details: "Offer submission recorded.",
                createdAt: "2026-03-24T12:12:00.000Z"
              }
            ],
            createdAt: "2026-03-24T12:06:00.000Z",
            updatedAt: "2026-03-25T09:00:00.000Z"
          }
        ]}
        underContracts={[
          {
            id: "under-contract-1",
            sessionId: "session-1",
            partnerId: null,
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Southfield, MI",
            shortlistId: "shortlist-1",
            financialReadinessId: "financial-1",
            offerPreparationId: "offer-prep-1",
            offerSubmissionId: "offer-submission-1",
            acceptedAt: "2026-03-25T09:00:00.000Z",
            targetClosingDate: "2026-04-24T17:00:00.000Z",
            inspectionDeadline: "2026-03-28T17:00:00.000Z",
            appraisalDeadline: "2026-04-04T17:00:00.000Z",
            financingDeadline: "2026-04-10T17:00:00.000Z",
            contingencyDeadline: "2026-03-30T17:00:00.000Z",
            closingPreparationDeadline: "2026-04-20T17:00:00.000Z",
            notes: "Inspection booked, financing in progress.",
            internalActivityNote: null,
            overallCoordinationState: "IN_PROGRESS",
            overallRiskLevel: "MODERATE_RISK",
            urgencyLevel: "MODERATE_RISK",
            readyForClosing: false,
            requiresImmediateAttention: true,
            taskSummaries: [
              {
                taskType: "HOME_INSPECTION",
                label: "Home inspection",
                status: "SCHEDULED",
                required: true,
                waivable: true,
                deadline: "2026-03-28T17:00:00.000Z",
                scheduledAt: "2026-03-27T10:00:00.000Z",
                completedAt: null,
                blockedReason: null,
                notes: "Booked with inspector."
              }
            ],
            milestoneSummaries: [
              {
                milestoneType: "INSPECTION_SCHEDULED",
                label: "Inspection scheduled",
                status: "REACHED",
                occurredAt: "2026-03-27T10:00:00.000Z",
                notes: null
              }
            ],
            deadlineSummaries: [
              {
                key: "inspection",
                label: "Inspection deadline",
                deadline: "2026-03-28T17:00:00.000Z",
                status: "APPROACHING",
                relatedTaskType: "HOME_INSPECTION"
              }
            ],
            missingItems: [],
            blockers: [],
            recommendation: "Advance the remaining contract tasks before deadlines tighten.",
            risk: "Some key dates are approaching and require active follow-through.",
            alternative: "Complete the remaining contract tasks earlier to reduce risk.",
            nextAction: "Review inspection results",
            nextSteps: ["Review inspection results", "Track contingency deadline"],
            activityLog: [
              {
                type: "task_updated",
                label: "Home inspection scheduled",
                details: "Booked with inspector.",
                createdAt: "2026-03-27T10:00:00.000Z"
              }
            ],
            lastActionAt: "2026-03-27T10:00:00.000Z",
            lastEvaluatedAt: "2026-03-27T10:00:00.000Z",
            createdAt: "2026-03-25T09:30:00.000Z",
            updatedAt: "2026-03-27T10:00:00.000Z"
          }
        ]}
        closingReadiness={[
          {
            id: "closing-1",
            sessionId: "session-1",
            partnerId: null,
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Southfield, MI",
            shortlistId: "shortlist-1",
            financialReadinessId: "financial-1",
            offerPreparationId: "offer-prep-1",
            offerSubmissionId: "offer-submission-1",
            underContractCoordinationId: "under-contract-1",
            targetClosingDate: "2026-04-24T17:00:00.000Z",
            closingAppointmentAt: "2026-04-24T15:00:00.000Z",
            closingAppointmentLocation: "Settlement office",
            closingAppointmentNotes: "Bring photo ID.",
            finalReviewDeadline: "2026-04-23T17:00:00.000Z",
            finalFundsConfirmationDeadline: "2026-04-24T12:00:00.000Z",
            finalFundsAmountConfirmed: 76570,
            closedAt: null,
            notes: "Final numbers reviewed.",
            internalActivityNote: null,
            closingSummary: {
              propertyId: "canonical-1",
              propertyAddressLabel: "123 Main St, Southfield, MI",
              underContractCoordinationId: "under-contract-1",
              targetClosingDate: "2026-04-24T17:00:00.000Z",
              closingAppointmentAt: "2026-04-24T15:00:00.000Z",
              closedAt: null
            },
            overallClosingReadinessState: "READY_TO_CLOSE",
            overallRiskLevel: "LOW_RISK",
            urgencyLevel: "LOW_RISK",
            readyToClose: true,
            closed: false,
            checklistItemSummaries: [
              {
                itemType: "FINAL_FUNDS_AVAILABLE",
                label: "Final funds available",
                status: "COMPLETED",
                required: true,
                waivable: false,
                deadline: "2026-04-24T12:00:00.000Z",
                completedAt: "2026-04-23T18:00:00.000Z",
                blockedReason: null,
                notes: "Wire ready."
              }
            ],
            milestoneSummaries: [
              {
                milestoneType: "READY_TO_CLOSE",
                label: "Ready to close",
                status: "REACHED",
                occurredAt: "2026-04-23T18:00:00.000Z",
                notes: null
              }
            ],
            missingItems: [],
            blockers: [],
            recommendation: "All required final items are satisfied.",
            risk: "No major closing risk is currently stored.",
            alternative: "Keep the appointment details unchanged and proceed.",
            nextAction: "Proceed to close",
            nextSteps: ["Proceed to close"],
            requiresImmediateAttention: false,
            activityLog: [
              {
                type: "ready_to_close",
                label: "Ready to close",
                details: "All required final closing items are complete.",
                createdAt: "2026-04-23T18:00:00.000Z"
              }
            ],
            lastActionAt: "2026-04-23T18:00:00.000Z",
            lastEvaluatedAt: "2026-04-23T18:00:00.000Z",
            createdAt: "2026-04-22T11:00:00.000Z",
            updatedAt: "2026-04-23T18:00:00.000Z"
          }
        ]}
        transactionCommandCenters={[
          {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Southfield, MI",
            sessionId: "session-1",
            shortlistId: "shortlist-1",
            currentStage: "CLOSING_READINESS",
            overallState: "READY_TO_ADVANCE",
            overallRiskLevel: "LOW_RISK",
            progressPercent: 83,
            completedStageCount: 5,
            totalStageCount: 6,
            primaryBlocker: null,
            activeBlockers: [],
            primaryRisk: null,
            topRisks: [],
            nextAction: "Proceed to close",
            nextSteps: ["Proceed to close"],
            keyDates: [],
            recentActivity: [],
            stageSummaries: [
              {
                stage: "CLOSING_READINESS",
                label: "Closing Readiness",
                status: "READY_TO_CLOSE",
                completed: true,
                available: true,
                blockerCount: 0,
                riskLevel: "LOW_RISK",
                nextAction: "Proceed to close",
                lastUpdatedAt: "2026-04-23T18:00:00.000Z"
              }
            ],
            sourceRefs: {
              financialReadinessId: "financial-1",
              offerPreparationId: "offer-prep-1",
              offerSubmissionId: "offer-submission-1",
              underContractCoordinationId: "under-contract-1",
              closingReadinessId: "closing-1"
            },
            isStale: false,
            lastUpdatedAt: "2026-04-23T18:00:00.000Z",
            createdAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        offerReadiness={[
          {
            id: "offer-1",
            propertyId: "canonical-1",
            shortlistId: "shortlist-1",
            shortlistItemId: "item-1",
            status: "IN_PROGRESS",
            readinessScore: 68,
            recommendedOfferPrice: 389000,
            confidence: "medium",
            inputs: {
              financingReadiness: "preapproved",
              propertyFitConfidence: "medium",
              riskToleranceAlignment: "partial",
              riskLevel: "balanced",
              userConfirmed: false,
              dataCompletenessScore: 82
            },
            blockingIssues: ["Buyer confirmation is still missing."],
            nextSteps: ["Confirm budget ceiling", "Finalize offer price"],
            lastEvaluatedAt: "2026-03-24T12:05:00.000Z",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:05:00.000Z"
          }
        ]}
        negotiations={[
          {
            id: "negotiation-1",
            propertyId: "canonical-1",
            shortlistId: "shortlist-1",
            offerReadinessId: "offer-1",
            status: "COUNTER_RECEIVED",
            initialOfferPrice: 389000,
            currentOfferPrice: 392000,
            sellerCounterPrice: 398000,
            buyerWalkAwayPrice: 400000,
            roundNumber: 2,
            guidance: {
              headline: "Seller counter has been received and is ready for buyer review.",
              riskLevel: "medium",
              nextSteps: ["Review the seller counter", "Decide whether to counter, accept, or reject"],
              flags: ["Seller counter is close to the recommended offer range."]
            },
            lastActionAt: "2026-03-24T12:10:00.000Z",
            createdAt: "2026-03-24T12:06:00.000Z",
            updatedAt: "2026-03-24T12:10:00.000Z"
          }
        ]}
        negotiationEventsByRecordId={{
          "negotiation-1": [
            {
              id: "negotiation-event-1",
              negotiationRecordId: "negotiation-1",
              type: "SELLER_COUNTER_RECEIVED",
              label: "Seller counter received",
              details: "Seller counter recorded at $398,000.",
              createdAt: "2026-03-24T12:10:00.000Z"
            }
          ]
        }}
        notes={[
          {
            id: "note-1",
            sessionId: "session-1",
            entityType: "shortlist_item",
            entityId: "item-1",
            body: "Strong candidate.",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        onAddNegotiationEvent={vi.fn()}
        onCreate={vi.fn()}
        onCreateNegotiation={vi.fn()}
        onCreateOfferPreparation={vi.fn()}
        onCreateOfferSubmission={vi.fn()}
        onCreateOfferReadiness={vi.fn()}
        onCreateUnderContract={vi.fn()}
        onDelete={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenHistoricalCompare={vi.fn()}
        onMoveBackup={vi.fn()}
        onRemoveItem={vi.fn()}
        onReviewStateChange={vi.fn()}
        onSaveNote={vi.fn()}
        onSelect={vi.fn()}
        onSelectChoice={vi.fn()}
        onSubmitOfferSubmission={vi.fn()}
        onTogglePinned={vi.fn()}
        onUpdateDecision={vi.fn()}
        onUpdateNegotiation={vi.fn()}
        onUpdateOfferPreparation={vi.fn()}
        onUpdateOfferSubmission={vi.fn()}
        onUpdateOfferReadiness={vi.fn()}
        onUpdateUnderContract={vi.fn()}
        onUpdateUnderContractMilestone={vi.fn()}
        onUpdateUnderContractTask={vi.fn()}
        onCreateClosingReadiness={vi.fn()}
        onUpdateClosingReadiness={vi.fn()}
        onUpdateClosingChecklistItem={vi.fn()}
        onUpdateClosingMilestone={vi.fn()}
        onMarkClosingReady={vi.fn()}
        onMarkClosingComplete={vi.fn()}
        onRespondToOfferSubmissionCounter={vi.fn()}
        selectedShortlistId="shortlist-1"
        shortlists={[
          {
            id: "shortlist-1",
            sessionId: "session-1",
            title: "Family shortlist",
            description: "Pilot set",
            sourceSnapshotId: "snapshot-1",
            pinned: true,
            itemCount: 2,
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        workflowActivity={[
          {
            id: "activity-1",
            sessionId: "session-1",
            eventType: "shortlist_created",
            shortlistId: "shortlist-1",
            shortlistItemId: null,
            noteId: null,
            payload: null,
            createdAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Family shortlist");
    expect(markup).toContain("123 Main St");
    expect(markup).toContain("Backups");
    expect(markup).toContain("456 Backup Ave");
    expect(markup).toContain("Workflow history");
    expect(markup).toContain("Compare to current");
    expect(markup).toContain("Edit rationale");
    expect(markup).toContain("Move down backup");
    expect(markup).toContain("Offer readiness");
    expect(markup).toContain("Recommended offer");
    expect(markup).toContain("Offer preparation");
    expect(markup).toContain("Proceed to offer submission");
    expect(markup).toContain("Offer submission");
    expect(markup).toContain("Review counteroffer");
    expect(markup).toContain("Under-contract coordination");
    expect(markup).toContain("Inspection deadline");
    expect(markup).toContain("Closing readiness");
    expect(markup).toContain("Proceed to close");
    expect(markup).toContain("Buyer transaction command center");
    expect(markup).toContain("Negotiation tracking");
    expect(markup).toContain("Seller counter received");
  });
});
