import type { FeedbackCategory, FeedbackRecord } from "@nhalo/types";

interface FeedbackPromptProps {
  open: boolean;
  title: string;
  question: string;
  options: Array<{
    label: string;
    value: FeedbackRecord["value"];
  }>;
  onDismiss(): void;
  onSubmit(payload: { value: FeedbackRecord["value"]; comment?: string | null; category: FeedbackCategory }): void;
  category: FeedbackCategory;
}

export function FeedbackPrompt({
  open,
  title,
  question,
  options,
  onDismiss,
  onSubmit,
  category
}: FeedbackPromptProps) {
  if (!open) {
    return null;
  }

  return (
    <section className="feedback-prompt">
      <div>
        <p className="section-label">Quick feedback</p>
        <h3>{title}</h3>
        <p className="muted">{question}</p>
      </div>
      <div className="activity-actions">
        {options.map((option) => (
          <button
            className="chip"
            key={option.label}
            onClick={() => onSubmit({ category, value: option.value })}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <button className="ghost-button" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
    </section>
  );
}
