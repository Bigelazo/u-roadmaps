---
status: accepted
---

# Defer institutional SSO logout until VTI provides a supported contract

U-Roadmaps distinguishes its application session from the institutional VTI session. Confirmed logout deletes the local NextAuth session and VTI transaction cookies through `POST /api/logout`, then returns the person to the public landing page. It must not claim to end the institutional session: cookies on the VTI and DCC portal domains are not writable by U-Roadmaps, so a later `/api/plogin/start` can still receive the identity already authenticated by those services.

## Investigation

The current VTI login URL points to the DCC portal's `/vti` route. Without an existing portal session, that route redirects to the UChile OAuth authorization endpoint and creates a portal `sessionid`. The portal also exposes `/logout`, but it redirects only to its own root and does not accept a return URL. The OAuth discovery document advertises `https://oauth2.uchile.cl/logout` as a revocation endpoint, but unauthenticated `GET` and `POST` requests to that URL return `404`; its required browser logout contract is therefore unavailable to this application. U-Roadmaps never receives the portal's OAuth token and cannot revoke it on the user's behalf.

The first implementation added the confirmation dialog in `SessionButton`, the local logout route, unit coverage for the dialog and cookie expiry, and an E2E scenario asserting that the application cookie is gone. That work intentionally stops at the application boundary. Opening the portal logout route in a popup or iframe was rejected: it has no supported return URL, is not proven to terminate the upstream OAuth session, and may be blocked or omit cookies under browser site policies.

## Consequences

The current “Cerrar sesión” action ends only the U-Roadmaps session. A future institutional logout requires one of the following, supplied and documented by VTI or the DCC portal owner:

- an RP-initiated logout endpoint that accepts an allowlisted post-logout return URL; or
- a supported reauthentication option for the portal's authorization request, such as `prompt=login` or an equivalent policy.

When that contract exists, add the configured endpoint or option to the login/logout flow and an E2E test against a non-production VTI environment: authenticate as one identity, close the U-Roadmaps and institutional sessions, then assert that the next entry presents credential collection instead of silently returning the prior identity.
