import type { WorkflowNotification, WorkflowNotificationHistoryEvent } from "@nhalo/types";
import { WorkflowAlertList } from "./WorkflowAlertList";

interface NotificationCenterPanelProps {
  notifications: WorkflowNotification[];
  history: WorkflowNotificationHistoryEvent[];
  onMarkRead(id: string): void;
  onDismiss(id: string): void;
}

export function NotificationCenterPanel({
  notifications,
  history,
  onMarkRead,
  onDismiss
}: NotificationCenterPanelProps) {
  const critical = notifications.filter((entry) => entry.severity === "CRITICAL");
  const warning = notifications.filter((entry) => entry.severity === "WARNING");
  const info = notifications.filter((entry) => entry.severity === "INFO");

  return (
    <section className="activity-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">Notifications</p>
          <h3>Active transaction alerts</h3>
          <p className="muted">Action-driving reminders, blockers, and milestones across your workflow.</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">{notifications.length} active</span>
          <span className="status-chip">{notifications.filter((entry) => entry.status === "UNREAD").length} unread</span>
        </div>
      </div>

      <div className="summary-grid">
        <WorkflowAlertList
          notifications={critical}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
          title="Critical"
          emptyMessage="No critical alerts right now."
        />
        <WorkflowAlertList
          notifications={warning}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
          title="Warnings"
          emptyMessage="No warning alerts right now."
        />
      </div>

      <div className="summary-grid">
        <WorkflowAlertList
          notifications={info}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
          title="Updates"
          emptyMessage="No informational alerts right now."
        />
        <div className="summary-block">
          <h3>History</h3>
          {history.length === 0 ? (
            <p className="muted">No notification history is stored yet.</p>
          ) : (
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.eventType.replaceAll("_", " ").toLowerCase()}</strong>
                  <div className="muted">{new Date(entry.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
