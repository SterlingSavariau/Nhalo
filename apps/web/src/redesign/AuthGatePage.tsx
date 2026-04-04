import type { SessionIdentity } from "@nhalo/types";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, type GoogleAuthResult } from "@/api";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./BrandMark";

const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

let googleIdentityScriptPromise: Promise<void> | null = null;
const GOOGLE_BUTTON_RENDER_RETRIES = 5;
const GOOGLE_BUTTON_RENDER_DELAY_MS = 60;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google sign-in failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in failed to load."));
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForGoogleButtonRender(container: HTMLDivElement): Promise<boolean> {
  for (let attempt = 0; attempt < GOOGLE_BUTTON_RENDER_RETRIES; attempt += 1) {
    if (container.childElementCount > 0 || container.innerHTML.trim().length > 0) {
      return true;
    }
    await delay(GOOGLE_BUTTON_RENDER_DELAY_MS);
  }

  return container.childElementCount > 0 || container.innerHTML.trim().length > 0;
}

interface AuthGatePageProps {
  sessionIdentity: SessionIdentity;
  onAuthenticated(result: GoogleAuthResult): void;
  onBackHome(): void;
}

export function AuthGatePage({
  sessionIdentity,
  onAuthenticated,
  onBackHome
}: AuthGatePageProps) {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const [loadingButton, setLoadingButton] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetryRender, setCanRetryRender] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setLoadingButton(false);
      return;
    }

    let disposed = false;

    async function setupGoogleButton() {
      setLoadingButton(true);
      setCanRetryRender(false);
      try {
        await loadGoogleIdentityScript();
        if (disposed || !buttonContainerRef.current || !window.google?.accounts?.id) {
          return;
        }

        setError(null);
        buttonContainerRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          context: "signup",
          cancel_on_tap_outside: true,
          callback: async (response) => {
            if (!response.credential) {
              setError("Google sign-in did not return a usable credential.");
              return;
            }

            setSubmitting(true);
            setError(null);
            setCanRetryRender(false);
            try {
              const result = await signInWithGoogle({
                credential: response.credential,
                sessionId: sessionIdentity.sessionId
              });
              onAuthenticatedRef.current(result);
            } catch (signInError) {
              setError(
                signInError instanceof Error ? signInError.message : "Google sign-in failed."
              );
            } finally {
              setSubmitting(false);
            }
          }
        });
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 360,
          logo_alignment: "left"
        });
        const rendered = await waitForGoogleButtonRender(buttonContainerRef.current);
        if (!rendered) {
          throw new Error("Google sign-in button did not render. Retry to continue.");
        }
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : "Google sign-in failed to load.");
          setCanRetryRender(true);
        }
      } finally {
        if (!disposed) {
          setLoadingButton(false);
        }
      }
    }

    void setupGoogleButton();

    return () => {
      disposed = true;
      window.google?.accounts?.id.cancel();
    };
  }, [renderAttempt, sessionIdentity.sessionId]);

  const configurationMissing = GOOGLE_CLIENT_ID.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex h-16 items-center justify-between">
            <button className="inline-flex items-center" onClick={onBackHome} type="button">
              <BrandMark />
            </button>
            <span className="text-sm text-muted-foreground">Create your account</span>
          </nav>
        </div>
      </header>

      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-md">
          <div className="space-y-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
              <ShieldCheck className="h-7 w-7 text-foreground" />
            </div>

            <div>
              <h1 className="font-serif text-3xl text-foreground">Sign in to start your search</h1>
              <p className="mt-3 text-muted-foreground">
                We&apos;ll use Google for account creation and sign-in, then take you straight into
                your Nhalo setup.
              </p>
            </div>

            <div className="space-y-4 border border-border bg-card p-6">
              <div>
                <p className="text-sm font-medium text-foreground">Continue with Google</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your home search stays tied to one account, so your setup, shortlist, and
                  workflow history follow you across sessions.
                </p>
              </div>

              {configurationMissing ? (
                <p className="text-sm text-destructive">
                  Google sign-in is not configured yet. Set `VITE_GOOGLE_CLIENT_ID` and
                  `GOOGLE_CLIENT_ID` to enable it.
                </p>
              ) : (
                <div className="relative min-h-11">
                  <div
                    aria-hidden={loadingButton}
                    className={loadingButton ? "pointer-events-none opacity-0" : undefined}
                    ref={buttonContainerRef}
                  />
                  {loadingButton ? (
                    <div className="absolute inset-0 flex h-11 items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading Google sign-in
                    </div>
                  ) : null}
                </div>
              )}

              {submitting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying your Google account
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              {canRetryRender ? (
                <Button
                  className="rounded-none"
                  onClick={() => {
                    setError(null);
                    setCanRetryRender(false);
                    setRenderAttempt((current) => current + 1);
                  }}
                  type="button"
                  variant="outline"
                >
                  Reload Google sign-in
                </Button>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-8">
              <Button
                className="rounded-none text-muted-foreground hover:text-foreground"
                onClick={onBackHome}
                type="button"
                variant="ghost"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
