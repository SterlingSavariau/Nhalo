import { ONBOARDING_CONTENT } from "../content";
import { Button } from "@/components/ui/button";
import { BrandMark } from "../redesign/BrandMark";

interface OnboardingModalProps {
  open: boolean;
  onDismiss(): void;
}

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/25 px-6 py-10 backdrop-blur-sm"
      role="dialog"
    >
      <section className="w-full max-w-4xl border border-border bg-background shadow-[0_28px_80px_rgba(29,24,19,0.18)]">
        <div className="border-b border-border px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-4">
              <BrandMark />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Welcome</p>
                <h2 className="max-w-2xl font-serif text-4xl leading-none text-foreground">
                  {ONBOARDING_CONTENT.title}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  A quick overview of how the dashboard is organized before you start ranking homes.
                </p>
              </div>
            </div>
            <Button
              className="rounded-none"
              onClick={onDismiss}
              type="button"
              variant="ghost"
            >
              Skip
            </Button>
          </div>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2">
          {ONBOARDING_CONTENT.sections.map((section) => (
            <article className="bg-background px-8 py-7" key={section.heading}>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {section.heading}
              </p>
              <p className="mt-3 max-w-md text-base leading-7 text-foreground/80">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-8 py-6">
          <p className="text-sm text-muted-foreground">
            You can dismiss this once. The dashboard will stay available underneath.
          </p>
          <Button className="rounded-none px-8" onClick={onDismiss} type="button">
            Start searching
          </Button>
        </div>
      </section>
    </div>
  );
}
