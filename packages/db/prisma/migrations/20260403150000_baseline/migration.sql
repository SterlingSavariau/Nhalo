-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "propertyType" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sqft" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION NOT NULL,
    "lotSqft" INTEGER,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "searchDefinitionId" TEXT,
    "rerunSourceType" TEXT,
    "rerunSourceId" TEXT,
    "demoScenarioId" TEXT,
    "locationType" TEXT NOT NULL,
    "locationValue" TEXT NOT NULL,
    "resolvedCity" TEXT,
    "resolvedState" TEXT,
    "resolvedPostalCode" TEXT,
    "resolvedFormattedAddress" TEXT,
    "originLatitude" DOUBLE PRECISION,
    "originLongitude" DOUBLE PRECISION,
    "originPrecision" TEXT,
    "geocodeProvider" TEXT,
    "geocodeDataSource" TEXT DEFAULT 'none',
    "geocodeFetchedAt" TIMESTAMP(3),
    "rawGeocodeInputs" JSONB,
    "normalizedGeocodeInputs" JSONB,
    "radiusMiles" DOUBLE PRECISION NOT NULL,
    "budget" JSONB,
    "filters" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "totalCandidatesScanned" INTEGER NOT NULL,
    "totalMatched" INTEGER NOT NULL,
    "returnedCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "warnings" JSONB,
    "suggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "partnerId" TEXT,
    "sessionId" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "contextJson" JSONB,
    "searchRequestId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQualityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSnapshot" (
    "id" TEXT NOT NULL,
    "formulaVersion" TEXT,
    "sessionId" TEXT,
    "searchDefinitionId" TEXT,
    "historyRecordId" TEXT,
    "demoScenarioId" TEXT,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchDefinition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "label" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedSnapshotLink" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedSnapshotLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "snapshotId" TEXT,
    "historyRecordId" TEXT,
    "searchDefinitionId" TEXT,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "sessionId" TEXT,
    "snapshotId" TEXT,
    "historyRecordId" TEXT,
    "searchDefinitionId" TEXT,
    "demoScenarioId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceSnapshotId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortlistItem" (
    "id" TEXT NOT NULL,
    "shortlistId" TEXT NOT NULL,
    "canonicalPropertyId" TEXT NOT NULL,
    "sourceSnapshotId" TEXT,
    "sourceHistoryId" TEXT,
    "sourceSearchDefinitionId" TEXT,
    "capturedHomePayload" JSONB NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'undecided',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReadiness" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "annualHouseholdIncome" INTEGER,
    "monthlyDebtPayments" INTEGER,
    "availableCashSavings" INTEGER,
    "creditScoreRange" TEXT,
    "desiredHomePrice" INTEGER,
    "purchaseLocation" TEXT,
    "downPaymentPreferencePercent" DOUBLE PRECISION,
    "loanType" TEXT,
    "preApprovalStatus" TEXT,
    "preApprovalExpiresAt" TIMESTAMP(3),
    "proofOfFundsStatus" TEXT,
    "maxAffordableHomePrice" INTEGER,
    "estimatedMonthlyPayment" INTEGER,
    "estimatedDownPayment" INTEGER,
    "estimatedClosingCosts" INTEGER,
    "totalCashRequiredToClose" INTEGER,
    "debtToIncomeRatio" DOUBLE PRECISION,
    "housingRatio" DOUBLE PRECISION,
    "affordabilityClassification" TEXT NOT NULL,
    "readinessState" TEXT NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "alternative" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "assumptionsJson" JSONB NOT NULL,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferPreparation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "propertyId" TEXT NOT NULL,
    "propertyAddressLabel" TEXT NOT NULL,
    "shortlistId" TEXT,
    "offerReadinessId" TEXT,
    "financialReadinessId" TEXT NOT NULL,
    "offerPrice" INTEGER,
    "earnestMoneyAmount" INTEGER,
    "downPaymentType" TEXT,
    "downPaymentAmount" INTEGER,
    "downPaymentPercent" DOUBLE PRECISION,
    "financingContingency" TEXT,
    "inspectionContingency" TEXT,
    "appraisalContingency" TEXT,
    "closingTimelineDays" INTEGER,
    "possessionTiming" TEXT,
    "possessionDaysAfterClosing" INTEGER,
    "sellerConcessionsRequestedAmount" INTEGER,
    "notes" TEXT,
    "buyerRationale" TEXT,
    "offerSummaryJson" JSONB NOT NULL,
    "offerState" TEXT NOT NULL,
    "offerRiskLevel" TEXT NOT NULL,
    "offerCompletenessState" TEXT NOT NULL,
    "readinessToSubmit" BOOLEAN NOT NULL DEFAULT false,
    "cashRequiredAtOffer" INTEGER,
    "missingItemsJson" JSONB NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "alternative" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "financialAlignmentJson" JSONB NOT NULL,
    "assumptionsJson" JSONB NOT NULL,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferSubmission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "propertyId" TEXT NOT NULL,
    "propertyAddressLabel" TEXT NOT NULL,
    "shortlistId" TEXT,
    "financialReadinessId" TEXT,
    "offerPreparationId" TEXT NOT NULL,
    "submissionMethod" TEXT,
    "submittedAt" TIMESTAMP(3),
    "offerExpirationAt" TIMESTAMP(3),
    "sellerResponseState" TEXT NOT NULL,
    "sellerRespondedAt" TIMESTAMP(3),
    "buyerCounterDecision" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "notes" TEXT,
    "internalActivityNote" TEXT,
    "originalOfferSnapshotJson" JSONB NOT NULL,
    "submissionSummaryJson" JSONB NOT NULL,
    "submissionState" TEXT NOT NULL,
    "urgencyLevel" TEXT NOT NULL,
    "counterofferPrice" INTEGER,
    "counterofferClosingTimelineDays" INTEGER,
    "counterofferFinancingContingency" TEXT,
    "counterofferInspectionContingency" TEXT,
    "counterofferAppraisalContingency" TEXT,
    "counterofferExpirationAt" TIMESTAMP(3),
    "counterofferSummaryJson" JSONB NOT NULL,
    "missingItemsJson" JSONB NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "alternative" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "requiresBuyerResponse" BOOLEAN NOT NULL DEFAULT false,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "activityLogJson" JSONB NOT NULL,
    "lastActionAt" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnderContractCoordination" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "propertyId" TEXT NOT NULL,
    "propertyAddressLabel" TEXT NOT NULL,
    "shortlistId" TEXT,
    "financialReadinessId" TEXT,
    "offerPreparationId" TEXT,
    "offerSubmissionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "targetClosingDate" TIMESTAMP(3) NOT NULL,
    "inspectionDeadline" TIMESTAMP(3),
    "appraisalDeadline" TIMESTAMP(3),
    "financingDeadline" TIMESTAMP(3),
    "contingencyDeadline" TIMESTAMP(3),
    "closingPreparationDeadline" TIMESTAMP(3),
    "notes" TEXT,
    "internalActivityNote" TEXT,
    "coordinationSummaryJson" JSONB NOT NULL,
    "overallCoordinationState" TEXT NOT NULL,
    "overallRiskLevel" TEXT NOT NULL,
    "urgencyLevel" TEXT NOT NULL,
    "readyForClosing" BOOLEAN NOT NULL DEFAULT false,
    "requiresImmediateAttention" BOOLEAN NOT NULL DEFAULT false,
    "taskRecordsJson" JSONB NOT NULL,
    "milestoneRecordsJson" JSONB NOT NULL,
    "deadlineRecordsJson" JSONB NOT NULL,
    "missingItemsJson" JSONB NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "alternative" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "activityLogJson" JSONB NOT NULL,
    "lastActionAt" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnderContractCoordination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingReadiness" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "partnerId" TEXT,
    "propertyId" TEXT NOT NULL,
    "propertyAddressLabel" TEXT NOT NULL,
    "shortlistId" TEXT,
    "financialReadinessId" TEXT,
    "offerPreparationId" TEXT,
    "offerSubmissionId" TEXT,
    "underContractCoordinationId" TEXT NOT NULL,
    "targetClosingDate" TIMESTAMP(3) NOT NULL,
    "closingAppointmentAt" TIMESTAMP(3),
    "closingAppointmentLocation" TEXT,
    "closingAppointmentNotes" TEXT,
    "finalReviewDeadline" TIMESTAMP(3),
    "finalFundsConfirmationDeadline" TIMESTAMP(3),
    "finalFundsAmountConfirmed" INTEGER,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalActivityNote" TEXT,
    "closingSummaryJson" JSONB NOT NULL,
    "overallClosingReadinessState" TEXT NOT NULL,
    "overallRiskLevel" TEXT NOT NULL,
    "urgencyLevel" TEXT NOT NULL,
    "readyToClose" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "checklistItemsJson" JSONB NOT NULL,
    "milestoneRecordsJson" JSONB NOT NULL,
    "missingItemsJson" JSONB NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "alternative" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "activityLogJson" JSONB NOT NULL,
    "requiresImmediateAttention" BOOLEAN NOT NULL DEFAULT false,
    "lastActionAt" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosingReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNotification" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "sessionId" TEXT,
    "propertyId" TEXT,
    "propertyAddressLabel" TEXT,
    "shortlistId" TEXT,
    "moduleName" TEXT NOT NULL,
    "alertCategory" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggeringRuleLabel" TEXT NOT NULL,
    "relatedSubjectType" TEXT NOT NULL,
    "relatedSubjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionTargetJson" JSONB,
    "dueAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "explanationSubjectType" TEXT,
    "explanationSubjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNotificationHistoryEvent" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousValue" TEXT,
    "nextValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowNotificationHistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnifiedActivityLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "sessionId" TEXT,
    "propertyId" TEXT,
    "propertyAddressLabel" TEXT,
    "shortlistId" TEXT,
    "moduleName" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "oldValueSnapshotJson" JSONB,
    "newValueSnapshotJson" JSONB,
    "triggerType" TEXT NOT NULL,
    "triggerLabel" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "relatedNotificationId" TEXT,
    "relatedExplanationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnifiedActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferReadiness" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "shortlistId" TEXT NOT NULL,
    "shortlistItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "readinessScore" INTEGER NOT NULL,
    "recommendedOfferPrice" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "financingReadiness" TEXT NOT NULL,
    "propertyFitConfidence" TEXT NOT NULL,
    "riskToleranceAlignment" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "dataCompletenessScore" INTEGER NOT NULL,
    "blockingIssuesJson" JSONB NOT NULL,
    "nextStepsJson" JSONB NOT NULL,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationRecord" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "shortlistId" TEXT,
    "offerReadinessId" TEXT,
    "status" TEXT NOT NULL,
    "initialOfferPrice" INTEGER NOT NULL,
    "currentOfferPrice" INTEGER NOT NULL,
    "sellerCounterPrice" INTEGER,
    "buyerWalkAwayPrice" INTEGER,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "guidanceHeadline" TEXT NOT NULL,
    "guidanceRiskLevel" TEXT NOT NULL,
    "guidanceFlagsJson" JSONB NOT NULL,
    "guidanceNextStepsJson" JSONB NOT NULL,
    "lastActionAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NegotiationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationEvent" (
    "id" TEXT NOT NULL,
    "negotiationRecordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedShortlistLink" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "shortlistId" TEXT NOT NULL,
    "sessionId" TEXT,
    "shareMode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedShortlistLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedComment" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorLabel" TEXT,
    "body" TEXT NOT NULL,
    "shortlistItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerDecision" (
    "id" TEXT NOT NULL,
    "shortlistItemId" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'free_demo',
    "status" TEXT NOT NULL,
    "contactLabel" TEXT,
    "notes" TEXT,
    "featureOverrides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotLink" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "allowedFeatures" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsAction" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "partnerId" TEXT,
    "result" TEXT NOT NULL,
    "details" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shortlistItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSnapshot" (
    "id" TEXT NOT NULL,
    "searchRequestId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "priceScore" INTEGER NOT NULL,
    "sizeScore" INTEGER NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "nhaloScore" INTEGER NOT NULL,
    "safetyConfidence" TEXT NOT NULL,
    "overallConfidence" TEXT NOT NULL,
    "pricePerSqft" DOUBLE PRECISION NOT NULL,
    "medianPricePerSqft" DOUBLE PRECISION NOT NULL,
    "crimeIndex" DOUBLE PRECISION,
    "schoolRating" DOUBLE PRECISION,
    "neighborhoodStability" DOUBLE PRECISION,
    "dataCompleteness" DOUBLE PRECISION NOT NULL,
    "safetyDataSource" TEXT NOT NULL DEFAULT 'none',
    "crimeProvider" TEXT,
    "schoolProvider" TEXT,
    "crimeFetchedAt" TIMESTAMP(3),
    "schoolFetchedAt" TIMESTAMP(3),
    "rawSafetyInputs" JSONB,
    "normalizedSafetyInputs" JSONB,
    "listingDataSource" TEXT NOT NULL DEFAULT 'none',
    "listingProvider" TEXT,
    "sourceListingId" TEXT,
    "listingFetchedAt" TIMESTAMP(3),
    "rawListingInputs" JSONB,
    "normalizedListingInputs" JSONB,
    "distanceMiles" DOUBLE PRECISION,
    "insideRequestedRadius" BOOLEAN NOT NULL DEFAULT true,
    "scoreInputs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "radiusMiles" DOUBLE PRECISION NOT NULL,
    "medianPricePerSqft" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetySignalCache" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "crimeProvider" TEXT,
    "schoolProvider" TEXT,
    "crimeRaw" JSONB,
    "crimeNormalized" DOUBLE PRECISION,
    "schoolRaw" JSONB,
    "schoolNormalized" DOUBLE PRECISION,
    "stabilityRaw" JSONB,
    "stabilityNormalized" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,

    CONSTRAINT "SafetySignalCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingCache" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationValue" TEXT NOT NULL,
    "radiusMiles" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "rawPayload" JSONB,
    "normalizedListings" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "rejectionSummary" JSONB NOT NULL,

    CONSTRAINT "ListingCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "queryValue" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "formattedAddress" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precision" TEXT NOT NULL,
    "rawPayload" JSONB,
    "normalizedPayload" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchRequest_sessionId_createdAt_idx" ON "SearchRequest"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchRequest_partnerId_createdAt_idx" ON "SearchRequest"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_severity_createdAt_idx" ON "DataQualityEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_sourceDomain_createdAt_idx" ON "DataQualityEvent"("sourceDomain", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_provider_createdAt_idx" ON "DataQualityEvent"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_partnerId_createdAt_idx" ON "DataQualityEvent"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_status_createdAt_idx" ON "DataQualityEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_targetType_targetId_createdAt_idx" ON "DataQualityEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "DataQualityEvent_searchRequestId_createdAt_idx" ON "DataQualityEvent"("searchRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchSnapshot_createdAt_idx" ON "SearchSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "SearchSnapshot_sessionId_createdAt_idx" ON "SearchSnapshot"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchSnapshot_historyRecordId_createdAt_idx" ON "SearchSnapshot"("historyRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchDefinition_sessionId_updatedAt_idx" ON "SearchDefinition"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedSnapshotLink_shareId_key" ON "SharedSnapshotLink"("shareId");

-- CreateIndex
CREATE INDEX "SharedSnapshotLink_snapshotId_createdAt_idx" ON "SharedSnapshotLink"("snapshotId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedSnapshotLink_shareId_expiresAt_revokedAt_idx" ON "SharedSnapshotLink"("shareId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "Feedback_sessionId_createdAt_idx" ON "Feedback"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_snapshotId_createdAt_idx" ON "Feedback"("snapshotId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_historyRecordId_createdAt_idx" ON "Feedback"("historyRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationEvent_eventName_createdAt_idx" ON "ValidationEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationEvent_sessionId_createdAt_idx" ON "ValidationEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationEvent_demoScenarioId_createdAt_idx" ON "ValidationEvent"("demoScenarioId", "createdAt");

-- CreateIndex
CREATE INDEX "Shortlist_sessionId_updatedAt_idx" ON "Shortlist"("sessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "Shortlist_sourceSnapshotId_createdAt_idx" ON "Shortlist"("sourceSnapshotId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortlistItem_shortlistId_addedAt_idx" ON "ShortlistItem"("shortlistId", "addedAt");

-- CreateIndex
CREATE INDEX "ShortlistItem_canonicalPropertyId_addedAt_idx" ON "ShortlistItem"("canonicalPropertyId", "addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistItem_shortlistId_canonicalPropertyId_key" ON "ShortlistItem"("shortlistId", "canonicalPropertyId");

-- CreateIndex
CREATE INDEX "FinancialReadiness_sessionId_updatedAt_idx" ON "FinancialReadiness"("sessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "FinancialReadiness_partnerId_updatedAt_idx" ON "FinancialReadiness"("partnerId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferPreparation_shortlistId_updatedAt_idx" ON "OfferPreparation"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferPreparation_propertyId_updatedAt_idx" ON "OfferPreparation"("propertyId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferPreparation_financialReadinessId_updatedAt_idx" ON "OfferPreparation"("financialReadinessId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferPreparation_sessionId_updatedAt_idx" ON "OfferPreparation"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferPreparation_shortlistId_propertyId_key" ON "OfferPreparation"("shortlistId", "propertyId");

-- CreateIndex
CREATE INDEX "OfferSubmission_shortlistId_updatedAt_idx" ON "OfferSubmission"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferSubmission_propertyId_updatedAt_idx" ON "OfferSubmission"("propertyId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferSubmission_offerPreparationId_updatedAt_idx" ON "OfferSubmission"("offerPreparationId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferSubmission_financialReadinessId_updatedAt_idx" ON "OfferSubmission"("financialReadinessId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferSubmission_sessionId_updatedAt_idx" ON "OfferSubmission"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferSubmission_shortlistId_propertyId_key" ON "OfferSubmission"("shortlistId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "UnderContractCoordination_offerSubmissionId_key" ON "UnderContractCoordination"("offerSubmissionId");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_shortlistId_updatedAt_idx" ON "UnderContractCoordination"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_propertyId_updatedAt_idx" ON "UnderContractCoordination"("propertyId", "updatedAt");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_offerSubmissionId_updatedAt_idx" ON "UnderContractCoordination"("offerSubmissionId", "updatedAt");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_financialReadinessId_updatedAt_idx" ON "UnderContractCoordination"("financialReadinessId", "updatedAt");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_offerPreparationId_updatedAt_idx" ON "UnderContractCoordination"("offerPreparationId", "updatedAt");

-- CreateIndex
CREATE INDEX "UnderContractCoordination_sessionId_updatedAt_idx" ON "UnderContractCoordination"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnderContractCoordination_shortlistId_propertyId_key" ON "UnderContractCoordination"("shortlistId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingReadiness_underContractCoordinationId_key" ON "ClosingReadiness"("underContractCoordinationId");

-- CreateIndex
CREATE INDEX "ClosingReadiness_shortlistId_updatedAt_idx" ON "ClosingReadiness"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_propertyId_updatedAt_idx" ON "ClosingReadiness"("propertyId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_underContractCoordinationId_updatedAt_idx" ON "ClosingReadiness"("underContractCoordinationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_offerSubmissionId_updatedAt_idx" ON "ClosingReadiness"("offerSubmissionId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_financialReadinessId_updatedAt_idx" ON "ClosingReadiness"("financialReadinessId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_offerPreparationId_updatedAt_idx" ON "ClosingReadiness"("offerPreparationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClosingReadiness_sessionId_updatedAt_idx" ON "ClosingReadiness"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingReadiness_shortlistId_propertyId_key" ON "ClosingReadiness"("shortlistId", "propertyId");

-- CreateIndex
CREATE INDEX "WorkflowNotification_sessionId_updatedAt_idx" ON "WorkflowNotification"("sessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_propertyId_updatedAt_idx" ON "WorkflowNotification"("propertyId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_shortlistId_updatedAt_idx" ON "WorkflowNotification"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_status_updatedAt_idx" ON "WorkflowNotification"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_severity_updatedAt_idx" ON "WorkflowNotification"("severity", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_moduleName_updatedAt_idx" ON "WorkflowNotification"("moduleName", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_relatedSubjectType_relatedSubjectId_up_idx" ON "WorkflowNotification"("relatedSubjectType", "relatedSubjectId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotification_triggeringRuleLabel_dueAt_updatedAt_idx" ON "WorkflowNotification"("triggeringRuleLabel", "dueAt", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowNotificationHistoryEvent_notificationId_createdAt_idx" ON "WorkflowNotificationHistoryEvent"("notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_sessionId_createdAt_idx" ON "UnifiedActivityLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_propertyId_createdAt_idx" ON "UnifiedActivityLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_shortlistId_createdAt_idx" ON "UnifiedActivityLog"("shortlistId", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_moduleName_createdAt_idx" ON "UnifiedActivityLog"("moduleName", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_eventCategory_createdAt_idx" ON "UnifiedActivityLog"("eventCategory", "createdAt");

-- CreateIndex
CREATE INDEX "UnifiedActivityLog_subjectType_subjectId_createdAt_idx" ON "UnifiedActivityLog"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferReadiness_shortlistItemId_key" ON "OfferReadiness"("shortlistItemId");

-- CreateIndex
CREATE INDEX "OfferReadiness_shortlistId_updatedAt_idx" ON "OfferReadiness"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfferReadiness_propertyId_updatedAt_idx" ON "OfferReadiness"("propertyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferReadiness_shortlistId_propertyId_key" ON "OfferReadiness"("shortlistId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationRecord_offerReadinessId_key" ON "NegotiationRecord"("offerReadinessId");

-- CreateIndex
CREATE INDEX "NegotiationRecord_shortlistId_updatedAt_idx" ON "NegotiationRecord"("shortlistId", "updatedAt");

-- CreateIndex
CREATE INDEX "NegotiationRecord_propertyId_updatedAt_idx" ON "NegotiationRecord"("propertyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationRecord_shortlistId_propertyId_key" ON "NegotiationRecord"("shortlistId", "propertyId");

-- CreateIndex
CREATE INDEX "NegotiationEvent_negotiationRecordId_createdAt_idx" ON "NegotiationEvent"("negotiationRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedShortlistLink_shareId_key" ON "SharedShortlistLink"("shareId");

-- CreateIndex
CREATE INDEX "SharedShortlistLink_shortlistId_createdAt_idx" ON "SharedShortlistLink"("shortlistId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedShortlistLink_shareId_expiresAt_revokedAt_idx" ON "SharedShortlistLink"("shareId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "SharedComment_shareId_updatedAt_idx" ON "SharedComment"("shareId", "updatedAt");

-- CreateIndex
CREATE INDEX "SharedComment_entityType_entityId_updatedAt_idx" ON "SharedComment"("entityType", "entityId", "updatedAt");

-- CreateIndex
CREATE INDEX "ReviewerDecision_shareId_updatedAt_idx" ON "ReviewerDecision"("shareId", "updatedAt");

-- CreateIndex
CREATE INDEX "ReviewerDecision_shortlistItemId_updatedAt_idx" ON "ReviewerDecision"("shortlistItemId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerDecision_shareId_shortlistItemId_key" ON "ReviewerDecision"("shareId", "shortlistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotPartner_slug_key" ON "PilotPartner"("slug");

-- CreateIndex
CREATE INDEX "PilotPartner_status_updatedAt_idx" ON "PilotPartner"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotLink_token_key" ON "PilotLink"("token");

-- CreateIndex
CREATE INDEX "PilotLink_partnerId_createdAt_idx" ON "PilotLink"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PilotLink_token_expiresAt_revokedAt_idx" ON "PilotLink"("token", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "OpsAction_partnerId_performedAt_idx" ON "OpsAction"("partnerId", "performedAt");

-- CreateIndex
CREATE INDEX "OpsAction_targetType_targetId_performedAt_idx" ON "OpsAction"("targetType", "targetId", "performedAt");

-- CreateIndex
CREATE INDEX "ResultNote_sessionId_updatedAt_idx" ON "ResultNote"("sessionId", "updatedAt");

-- CreateIndex
CREATE INDEX "ResultNote_entityType_entityId_updatedAt_idx" ON "ResultNote"("entityType", "entityId", "updatedAt");

-- CreateIndex
CREATE INDEX "ScoreSnapshot_searchRequestId_idx" ON "ScoreSnapshot"("searchRequestId");

-- CreateIndex
CREATE INDEX "ScoreSnapshot_propertyId_idx" ON "ScoreSnapshot"("propertyId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_location_radiusMiles_createdAt_idx" ON "MarketSnapshot"("location", "radiusMiles", "createdAt");

-- CreateIndex
CREATE INDEX "SafetySignalCache_locationKey_fetchedAt_idx" ON "SafetySignalCache"("locationKey", "fetchedAt");

-- CreateIndex
CREATE INDEX "ListingCache_locationKey_fetchedAt_idx" ON "ListingCache"("locationKey", "fetchedAt");

-- CreateIndex
CREATE INDEX "GeocodeCache_queryType_queryValue_fetchedAt_idx" ON "GeocodeCache"("queryType", "queryValue", "fetchedAt");

-- AddForeignKey
ALTER TABLE "DataQualityEvent" ADD CONSTRAINT "DataQualityEvent_searchRequestId_fkey" FOREIGN KEY ("searchRequestId") REFERENCES "SearchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedSnapshotLink" ADD CONSTRAINT "SharedSnapshotLink_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SearchSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SearchSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_historyRecordId_fkey" FOREIGN KEY ("historyRecordId") REFERENCES "SearchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_searchDefinitionId_fkey" FOREIGN KEY ("searchDefinitionId") REFERENCES "SearchDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEvent" ADD CONSTRAINT "ValidationEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SearchSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEvent" ADD CONSTRAINT "ValidationEvent_historyRecordId_fkey" FOREIGN KEY ("historyRecordId") REFERENCES "SearchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationEvent" ADD CONSTRAINT "ValidationEvent_searchDefinitionId_fkey" FOREIGN KEY ("searchDefinitionId") REFERENCES "SearchDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "SearchSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "SearchSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_sourceHistoryId_fkey" FOREIGN KEY ("sourceHistoryId") REFERENCES "SearchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_sourceSearchDefinitionId_fkey" FOREIGN KEY ("sourceSearchDefinitionId") REFERENCES "SearchDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPreparation" ADD CONSTRAINT "OfferPreparation_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPreparation" ADD CONSTRAINT "OfferPreparation_financialReadinessId_fkey" FOREIGN KEY ("financialReadinessId") REFERENCES "FinancialReadiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPreparation" ADD CONSTRAINT "OfferPreparation_offerReadinessId_fkey" FOREIGN KEY ("offerReadinessId") REFERENCES "OfferReadiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferSubmission" ADD CONSTRAINT "OfferSubmission_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferSubmission" ADD CONSTRAINT "OfferSubmission_financialReadinessId_fkey" FOREIGN KEY ("financialReadinessId") REFERENCES "FinancialReadiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferSubmission" ADD CONSTRAINT "OfferSubmission_offerPreparationId_fkey" FOREIGN KEY ("offerPreparationId") REFERENCES "OfferPreparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderContractCoordination" ADD CONSTRAINT "UnderContractCoordination_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderContractCoordination" ADD CONSTRAINT "UnderContractCoordination_financialReadinessId_fkey" FOREIGN KEY ("financialReadinessId") REFERENCES "FinancialReadiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderContractCoordination" ADD CONSTRAINT "UnderContractCoordination_offerPreparationId_fkey" FOREIGN KEY ("offerPreparationId") REFERENCES "OfferPreparation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderContractCoordination" ADD CONSTRAINT "UnderContractCoordination_offerSubmissionId_fkey" FOREIGN KEY ("offerSubmissionId") REFERENCES "OfferSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingReadiness" ADD CONSTRAINT "ClosingReadiness_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingReadiness" ADD CONSTRAINT "ClosingReadiness_financialReadinessId_fkey" FOREIGN KEY ("financialReadinessId") REFERENCES "FinancialReadiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingReadiness" ADD CONSTRAINT "ClosingReadiness_offerPreparationId_fkey" FOREIGN KEY ("offerPreparationId") REFERENCES "OfferPreparation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingReadiness" ADD CONSTRAINT "ClosingReadiness_offerSubmissionId_fkey" FOREIGN KEY ("offerSubmissionId") REFERENCES "OfferSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingReadiness" ADD CONSTRAINT "ClosingReadiness_underContractCoordinationId_fkey" FOREIGN KEY ("underContractCoordinationId") REFERENCES "UnderContractCoordination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNotificationHistoryEvent" ADD CONSTRAINT "WorkflowNotificationHistoryEvent_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "WorkflowNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferReadiness" ADD CONSTRAINT "OfferReadiness_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferReadiness" ADD CONSTRAINT "OfferReadiness_shortlistItemId_fkey" FOREIGN KEY ("shortlistItemId") REFERENCES "ShortlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRecord" ADD CONSTRAINT "NegotiationRecord_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRecord" ADD CONSTRAINT "NegotiationRecord_offerReadinessId_fkey" FOREIGN KEY ("offerReadinessId") REFERENCES "OfferReadiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationEvent" ADD CONSTRAINT "NegotiationEvent_negotiationRecordId_fkey" FOREIGN KEY ("negotiationRecordId") REFERENCES "NegotiationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedShortlistLink" ADD CONSTRAINT "SharedShortlistLink_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedComment" ADD CONSTRAINT "SharedComment_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "SharedShortlistLink"("shareId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedComment" ADD CONSTRAINT "SharedComment_shortlistItemId_fkey" FOREIGN KEY ("shortlistItemId") REFERENCES "ShortlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerDecision" ADD CONSTRAINT "ReviewerDecision_shortlistItemId_fkey" FOREIGN KEY ("shortlistItemId") REFERENCES "ShortlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerDecision" ADD CONSTRAINT "ReviewerDecision_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "SharedShortlistLink"("shareId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotLink" ADD CONSTRAINT "PilotLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PilotPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsAction" ADD CONSTRAINT "OpsAction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PilotPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultNote" ADD CONSTRAINT "ResultNote_shortlistItemId_fkey" FOREIGN KEY ("shortlistItemId") REFERENCES "ShortlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_searchRequestId_fkey" FOREIGN KEY ("searchRequestId") REFERENCES "SearchRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

