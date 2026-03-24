import type { SharedSnapshotView } from "@nhalo/types";
import { RESULT_COPY } from "../content";

interface SharedSnapshotBannerProps {
  sharedView: SharedSnapshotView;
  appName: string;
  tagline: string;
}

export function SharedSnapshotBanner({ sharedView, appName, tagline }: SharedSnapshotBannerProps) {
  return (
    <section className="shared-banner">
      <p className="eyebrow">{appName}</p>
      <h1 className="shared-title">{tagline}</h1>
      <p className="section-label">{RESULT_COPY.sharedSnapshotTitle}</p>
      <h2>Read-only shared result set</h2>
      <p className="muted">{RESULT_COPY.sharedSnapshotWarning}</p>
      <p className="muted">
        Snapshot created {new Date(sharedView.snapshot.createdAt).toLocaleString()} · formula{" "}
        {sharedView.snapshot.formulaVersion ?? "nhalo-v1"} · opens {sharedView.share.openCount}
      </p>
    </section>
  );
}
