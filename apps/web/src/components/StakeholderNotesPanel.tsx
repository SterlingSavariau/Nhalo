import { RESULT_COPY } from "../content";

interface StakeholderNotesPanelProps {
  note: string;
  onChange(value: string): void;
}

export function StakeholderNotesPanel({ note, onChange }: StakeholderNotesPanelProps) {
  return (
    <section className="notes-panel">
      <p className="section-label">{RESULT_COPY.notesTitle}</p>
      <h3>Local-only notes</h3>
      <p className="muted">
        These notes stay in this browser only. They are not shared with snapshots or sent to the API.
      </p>
      <label>
        <span>What should a stakeholder notice in this scenario?</span>
        <textarea
          onChange={(event) => onChange(event.target.value)}
          placeholder="Example: This scenario shows why safety weighting can change the shortlist without changing family constraints."
          rows={5}
          value={note}
        />
      </label>
    </section>
  );
}
