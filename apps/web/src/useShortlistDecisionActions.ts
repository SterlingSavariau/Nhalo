import { useCallback, useMemo } from "react";
import type {
  DecisionConfidence,
  DroppedReason,
  ShortlistItem
} from "@nhalo/types";
import {
  dropShortlistItem as dropShortlistItemApi,
  reorderShortlistItems as reorderShortlistItemsApi,
  selectShortlistItem as selectShortlistItemApi,
  updateShortlistItem as updateShortlistItemApi
} from "./api";

interface ShortlistDecisionPatch {
  decisionRationale?: string | null;
  decisionConfidence?: DecisionConfidence | null;
  lastDecisionReviewedAt?: string | null;
}

interface ShortlistDecisionActionsApi {
  selectShortlistItem: typeof selectShortlistItemApi;
  reorderShortlistItems: typeof reorderShortlistItemsApi;
  dropShortlistItem: typeof dropShortlistItemApi;
  updateShortlistItem: typeof updateShortlistItemApi;
}

interface UseShortlistDecisionActionsOptions {
  sessionId: string | null;
  shortlistItems: ShortlistItem[];
  refreshWorkflowState(sessionId?: string | null, preferredShortlistId?: string | null): Promise<void>;
  onError(message: string): void;
  api?: Partial<ShortlistDecisionActionsApi>;
}

export function getOrderedBackupItemIds(
  shortlistItems: ShortlistItem[],
  shortlistId: string
): string[] {
  return [...shortlistItems]
    .filter((entry) => entry.shortlistId === shortlistId && entry.choiceStatus === "backup")
    .sort(
      (left, right) =>
        (left.selectionRank ?? Number.POSITIVE_INFINITY) -
        (right.selectionRank ?? Number.POSITIVE_INFINITY)
    )
    .map((entry) => entry.id);
}

export function moveBackupItemId(
  orderedBackupItemIds: string[],
  itemId: string,
  direction: "up" | "down"
): string[] | null {
  const index = orderedBackupItemIds.indexOf(itemId);
  if (index === -1) {
    return null;
  }

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= orderedBackupItemIds.length) {
    return null;
  }

  const reordered = [...orderedBackupItemIds];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  return reordered;
}

export function useShortlistDecisionActions({
  sessionId,
  shortlistItems,
  refreshWorkflowState,
  onError,
  api
}: UseShortlistDecisionActionsOptions) {
  const apiClient = useMemo<ShortlistDecisionActionsApi>(
    () => ({
      selectShortlistItem: api?.selectShortlistItem ?? selectShortlistItemApi,
      reorderShortlistItems: api?.reorderShortlistItems ?? reorderShortlistItemsApi,
      dropShortlistItem: api?.dropShortlistItem ?? dropShortlistItemApi,
      updateShortlistItem: api?.updateShortlistItem ?? updateShortlistItemApi
    }),
    [api]
  );

  const handleSelectShortlistChoice = useCallback(
    async (shortlistId: string, itemId: string) => {
      try {
        await apiClient.selectShortlistItem(shortlistId, itemId, {
          replaceMode: "backup",
          lastDecisionReviewedAt: new Date().toISOString()
        });
        await refreshWorkflowState(sessionId, shortlistId);
      } catch (workflowError) {
        onError(
          workflowError instanceof Error
            ? workflowError.message
            : "Unable to update selected choice"
        );
      }
    },
    [apiClient, onError, refreshWorkflowState, sessionId]
  );

  const handleDropShortlistChoice = useCallback(
    async (
      shortlistId: string,
      itemId: string,
      droppedReason: DroppedReason = "other"
    ) => {
      try {
        await apiClient.dropShortlistItem(shortlistId, itemId, {
          droppedReason
        });
        await refreshWorkflowState(sessionId, shortlistId);
      } catch (workflowError) {
        onError(
          workflowError instanceof Error
            ? workflowError.message
            : "Unable to drop selected choice"
        );
      }
    },
    [apiClient, onError, refreshWorkflowState, sessionId]
  );

  const handleUpdateShortlistDecision = useCallback(
    async (shortlistId: string, itemId: string, patch: ShortlistDecisionPatch) => {
      try {
        await apiClient.updateShortlistItem(shortlistId, itemId, patch);
        await refreshWorkflowState(sessionId, shortlistId);
      } catch (workflowError) {
        onError(
          workflowError instanceof Error
            ? workflowError.message
            : "Unable to update shortlist decision"
        );
      }
    },
    [apiClient, onError, refreshWorkflowState, sessionId]
  );

  const handleMoveShortlistBackup = useCallback(
    async (shortlistId: string, itemId: string, direction: "up" | "down") => {
      const orderedBackups = getOrderedBackupItemIds(shortlistItems, shortlistId);
      const reordered = moveBackupItemId(orderedBackups, itemId, direction);
      if (!reordered) {
        return;
      }

      try {
        await apiClient.reorderShortlistItems(shortlistId, reordered);
        await refreshWorkflowState(sessionId, shortlistId);
      } catch (workflowError) {
        onError(
          workflowError instanceof Error ? workflowError.message : "Unable to reorder backups"
        );
      }
    },
    [apiClient, onError, refreshWorkflowState, sessionId, shortlistItems]
  );

  return {
    handleSelectShortlistChoice,
    handleDropShortlistChoice,
    handleUpdateShortlistDecision,
    handleMoveShortlistBackup
  };
}
