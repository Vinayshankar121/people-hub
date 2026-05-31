- [x] Fix Google Connect flow to reliably use async `connectGoogleViaRedirect()` (remove sync `getGoogleConnectUrl()` dependency in UI)

- [ ] Add refresh-token support in `googleCalendar.ts` so sync works after access token expiration
- [ ] Update token exchange/callback and stored token shape accordingly
- [ ] Sanity-check compilation via `npm run build` (or `npm run typecheck` if available)
- [ ] Manual test flow: /calendar -> Connect -> approve -> Sync -> verify events

