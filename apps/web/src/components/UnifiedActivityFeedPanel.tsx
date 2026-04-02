import type { UnifiedActivityRecord } from "@nhalo/types";

interface UnifiedActivityFeedPanelProps {
  activity: UnifiedActivityRecord[];
  title?: string;
  emptyMessage?: string;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function UnifiedActivityFeedPanel({
  activity,
  title = "Activity and audit log",
  emptyMessage = "No workflow activity has been recorded yet."
}: UnifiedActivityFeedPanelProps) {
  return (
    <section className="activity-panel">
      <div className="summary-header">
        <h3>{title}</h3>
        <p className="muted">{activity.length} recent events</p>
      </div>

      <div className="activity-list">
        {activity.map((entry) => (
          <article className="activity-card" key={entry.id}>
            <div>
              <p className="section-label">
                {humanize(entry.moduleName)} · {humanize(entry.eventCategory)}
              </p>
              <strong>{entry.title}</strong>
              <p className="muted">{entry.summary}</p>
              <p className="muted">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
          </article>
        ))}
        {activity.length === 0 ? <p className="muted">{emptyMessage}</p> : null}
      </div>
    </section>
  );
}
