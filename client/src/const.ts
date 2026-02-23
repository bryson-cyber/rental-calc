export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// Encodes the current page path into the OAuth state so the callback can redirect back.
export const getLoginUrl = (returnTo?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // Encode both the redirectUri and the returnTo path into state
  const returnPath = returnTo || window.location.pathname + window.location.search;
  const statePayload = JSON.stringify({ redirectUri, returnTo: returnPath });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
