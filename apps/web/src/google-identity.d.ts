export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (response: { credential: string; select_by: string }) => void;
            ux_mode?: "popup" | "redirect";
            context?: "signin" | "signup" | "use";
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?:
                | "signin_with"
                | "signup_with"
                | "continue_with"
                | "signin"
                | "signup"
                | "continue";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            }
          ): void;
          prompt(): void;
          cancel(): void;
          disableAutoSelect(): void;
        };
      };
      maps?: {
        event: {
          clearInstanceListeners(instance: object): void;
        };
        places: {
          Autocomplete: new (
            inputField: HTMLInputElement,
            options?: {
              componentRestrictions?: {
                country: string | string[];
              };
              fields?: string[];
              types?: string[];
            }
          ) => {
            addListener(eventName: "place_changed", handler: () => void): void;
            getPlace(): {
              name?: string;
              formatted_address?: string;
              types?: string[];
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
            };
          };
        };
      };
    };
  }
}
