import type { WorkflowNotification } from "@nhalo/types";

interface WorkflowAlertListProps {
  notifications: WorkflowNotification[];
  title: string;
  emptyMessage?: string;
  onMarkRead?(id: string): void;
  onDismiss?(id: string): void;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function WorkflowAlertList({
  notifications,
  title,
  emptyMessage = "No active alerts right now.",
  onMarkRead,
  onDismiss
}: WorkflowAlertListProps) {
  return (
    <div className="summary-block">
      <h3>{title}</h3>
      {notifications.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <ul>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <strong>{notification.title}</strong>
              <div className="muted">
                {humanize(notification.severity)} · {humanize(notification.alertCategory)}
                {notification.dueAt ? ` · due ${new Date(notification.dueAt).toLocaleString()}` : ""}
              </div>
              <div>{notification.message}</div>
              <div className="chip-row" style={{ marginTop: 8 }}>
                {notification.actionLabel ? <span className="chip">{notification.actionLabel}</span> : null}
                {notification.status === "UNREAD" && onMarkRead ? (
                  <button className="chip" onClick={() => onMarkRead(notification.id)} type="button">
                    Mark read
                  </button>
                ) : null}
                {notification.severity !== "CRITICAL" && notification.status !== "DISMISSED" && onDismiss ? (
                  <button className="chip" onClick={() => onDismiss(notification.id)} type="button">
                    Dismiss
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
