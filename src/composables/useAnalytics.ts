/**
 * Cookie-free, zero-dependency analytics.
 *
 * `track()` safely no-ops unless a provider script is present on the page.
 * Supported providers (either or both):
 *   - Plausible: `window.plausible(event, { props })`
 *   - Umami:     `window.umami.track(event, props)`
 *
 * To enable, add the provider's <script> tag to index.html, e.g.:
 *   <script defer data-domain="your.domain" src="https://plausible.io/js/script.js"></script>
 * or
 *   <script defer src="https://cloud.umami.is/script.js" data-website-id="…"></script>
 *
 * No provider script → every call is a silent no-op. No cookies, ever.
 */

type EventProps = Record<string, string | number>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps }) => void;
    umami?: { track: (event: string, props?: EventProps) => void };
  }
}

export function track(event: string, props?: EventProps): void {
  try {
    window.plausible?.(event, props ? { props } : undefined);
    window.umami?.track(event, props);
  } catch {
    /* analytics must never break the inn */
  }
}

export function useAnalytics(): { track: typeof track } {
  return { track };
}
