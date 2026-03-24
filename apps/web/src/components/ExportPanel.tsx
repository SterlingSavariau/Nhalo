import type { SearchSnapshotRecord } from "@nhalo/types";
import { RESULT_COPY } from "../content";

interface ExportPanelProps {
  exportDisabled?: boolean;
  onCopySummary(): void;
  onDownloadJson(): void;
  onPrintView(): void;
  snapshot: SearchSnapshotRecord | null;
}

export function ExportPanel({
  exportDisabled = false,
  onCopySummary,
  onDownloadJson,
  onPrintView,
  snapshot
}: ExportPanelProps) {
  if (!snapshot) {
    return null;
  }

  return (
    <section className="export-panel">
      <p className="section-label">{RESULT_COPY.exportTitle}</p>
      <h3>Share stored output without rerunning the search</h3>
      <p className="muted">
        Exports use the stored snapshot only. They do not refresh listings, safety data, or ranking.
      </p>
      <div className="activity-actions">
        <button className="chip" disabled={exportDisabled} onClick={onCopySummary} type="button">
          Copy summary
        </button>
        <button className="chip" disabled={exportDisabled} onClick={onDownloadJson} type="button">
          Download JSON
        </button>
        <button className="chip" disabled={exportDisabled} onClick={onPrintView} type="button">
          Print view
        </button>
      </div>
    </section>
  );
}
