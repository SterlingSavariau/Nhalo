import type {
  SearchDefinition,
  SearchHistoryRecord,
  SearchRequest,
  SearchRestorePayload,
  SearchSnapshotRecord
} from "@nhalo/types";

interface RecentActivityPanelProps {
  definitions: SearchDefinition[];
  history: SearchHistoryRecord[];
  snapshots: SearchSnapshotRecord[];
  currentRequest: SearchRequest;
  saveLabel: string;
  savingDefinition: boolean;
  onSaveLabelChange(value: string): void;
  onSaveDefinition(): void;
  onRestore(payload: SearchRestorePayload): void;
  onRerunDefinition(id: string): void;
  onRerunHistory(id: string): void;
  onOpenSnapshot(id: string): void;
  onTogglePinned(definition: SearchDefinition): void;
  onDeleteDefinition(id: string): void;
}

function formatWhen(timestamp: string | null): string {
  if (!timestamp) {
    return "Never run";
  }

  return new Date(timestamp).toLocaleString();
}

export function RecentActivityPanel({
  definitions,
  history,
  snapshots,
  currentRequest,
  saveLabel,
  savingDefinition,
  onSaveLabelChange,
  onSaveDefinition,
  onRestore,
  onRerunDefinition,
  onRerunHistory,
  onOpenSnapshot,
  onTogglePinned,
  onDeleteDefinition
}: RecentActivityPanelProps) {
  return (
    <section className="activity-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">Recent Activity</p>
          <h3>Continue decision work across sessions</h3>
        </div>
      </div>

      <div className="activity-save">
        <label>
          <span>Save current search definition</span>
          <input
            placeholder="e.g. Southfield 4-bed safety search"
            value={saveLabel}
            onChange={(event) => onSaveLabelChange(event.target.value)}
          />
        </label>
        <button className="submit-button" disabled={savingDefinition || !saveLabel.trim()} onClick={onSaveDefinition} type="button">
          {savingDefinition ? "Saving..." : "Save search"}
        </button>
        <p className="muted">
          Current request: {currentRequest.locationValue} · {currentRequest.radiusMiles ?? 0} miles
        </p>
      </div>

      <div className="activity-section">
        <div className="summary-header">
          <h4>Saved Searches</h4>
          <p className="muted">{definitions.length} saved</p>
        </div>
        <div className="activity-list">
          {definitions.map((definition) => (
            <article className="activity-card" key={definition.id}>
              <div>
                <p className="section-label">Saved definition {definition.pinned ? "· pinned" : ""}</p>
                <strong>{definition.label}</strong>
                <p className="muted">
                  {definition.request.locationValue} · {formatWhen(definition.lastRunAt)}
                </p>
              </div>
              <div className="activity-actions">
                <button
                  className="chip"
                  onClick={() =>
                    onRestore({
                      sourceType: "definition",
                      sourceId: definition.id,
                      label: definition.label,
                      request: definition.request
                    })
                  }
                  type="button"
                >
                  Restore
                </button>
                <button className="chip" onClick={() => onRerunDefinition(definition.id)} type="button">
                  Rerun
                </button>
                <button className="chip" onClick={() => onTogglePinned(definition)} type="button">
                  {definition.pinned ? "Unpin" : "Pin"}
                </button>
                <button className="chip" onClick={() => onDeleteDefinition(definition.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
          {definitions.length === 0 ? <p className="muted">No saved searches for this session yet.</p> : null}
        </div>
      </div>

      <div className="activity-section">
        <div className="summary-header">
          <h4>Recent Searches</h4>
          <p className="muted">{history.length} recent runs</p>
        </div>
        <div className="activity-list">
          {history.map((record) => (
            <article className="activity-card" key={record.id}>
              <div>
                <p className="section-label">Historical run</p>
                <strong>{record.request.locationValue}</strong>
                <p className="muted">
                  {record.summaryMetadata.returnedCount} results · {formatWhen(record.createdAt)}
                </p>
              </div>
              <div className="activity-actions">
                <button
                  className="chip"
                  onClick={() =>
                    onRestore({
                      sourceType: "history",
                      sourceId: record.id,
                      label: `${record.request.locationValue} run`,
                      request: record.request
                    })
                  }
                  type="button"
                >
                  Restore
                </button>
                <button className="chip" onClick={() => onRerunHistory(record.id)} type="button">
                  Rerun
                </button>
                {record.snapshotId ? (
                  <button className="chip" onClick={() => onOpenSnapshot(record.snapshotId!)} type="button">
                    Open snapshot
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {history.length === 0 ? <p className="muted">No recent searches stored for this session.</p> : null}
        </div>
      </div>

      <div className="activity-section">
        <div className="summary-header">
          <h4>Recent Snapshots</h4>
          <p className="muted">{snapshots.length} immutable snapshots</p>
        </div>
        <div className="activity-list">
          {snapshots.map((snapshot) => (
            <article className="activity-card" key={snapshot.id}>
              <div>
                <p className="section-label">Immutable snapshot</p>
                <strong>{snapshot.request.locationValue}</strong>
                <p className="muted">
                  {snapshot.response.metadata.returnedCount} results · {formatWhen(snapshot.createdAt)}
                </p>
              </div>
              <div className="activity-actions">
                <button
                  className="chip"
                  onClick={() =>
                    onRestore({
                      sourceType: "snapshot",
                      sourceId: snapshot.id,
                      label: `${snapshot.request.locationValue} snapshot`,
                      request: snapshot.request
                    })
                  }
                  type="button"
                >
                  Restore
                </button>
                <button className="chip" onClick={() => onOpenSnapshot(snapshot.id)} type="button">
                  Open snapshot
                </button>
              </div>
            </article>
          ))}
          {snapshots.length === 0 ? <p className="muted">No snapshots saved for this session yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
