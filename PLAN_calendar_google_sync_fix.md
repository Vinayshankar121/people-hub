# Plan: Google Calendar not showing directly

## Information Gathered
- UI includes a `GoogleCalendarPanel` on `/calendar` that shows **Connect** only when `isGoogleConnected()` is true/false.
- OAuth flow is implemented in `src/integrations/google/googleCalendar.ts`.
- `/calendar` route runs `handleGoogleOAuthCallback()` inside `beforeLoad` when `code`/`error` query params exist.
- Current implementation stores the token in `localStorage` under key `google_calendar_token`.
- Potential problem: `isGoogleConnected()` checks only `access_token` existence; however OAuth consent may not always return an `access_token` stored as expected, or the token stored after callback might not include `access_token` immediately.
- Another potential problem: `GoogleCalendarPanel` never updates `connected` state after callback redirect unless the `beforeLoad` callback correctly runs and token exchange succeeds.

## Plan
1. **Fix connection detection**
   - Change `isGoogleConnected()` to return connected when a `refresh_token` exists (preferred) or when `access_token` exists.
2. **Improve callback route behavior**
   - Ensure callback is executed whenever `code`/`error` exists, and also ensure that after callback, the page re-renders or `connected` state is re-evaluated.
   - Optionally, export a function to force refresh connection state from panel, but easiest is to adjust `isGoogleConnected()` logic.
3. **Sync reliability**
   - If sync is called after a redirect, make sure `handleGoogleOAuthCallback()` sets token correctly so sync can fetch an access token (currently refresh logic depends on refresh_token).
   - (If needed later) update sync to always refresh access token from refresh_token.
4. **Sanity-check**
   - Run `npm run build` or `npm run typecheck` to confirm compilation.

## Dependent Files to Edit
- `people-hub/src/integrations/google/googleCalendar.ts`
- (Possibly) `people-hub/src/components/hrms/GoogleCalendarPanel.tsx`
- (Possibly) `people-hub/src/routes/calendar.tsx`

## Followup steps
- Manual test: /calendar -> Connect -> approve -> redirect back -> should show Connected.
- Manual test: after refresh, Connected should still show (based on refresh_token).

<ask_followup_question>
Please confirm the exact expected behavior: when user clicks Connect on `/calendar`, after Google approves and redirects back, should the panel automatically switch from “Not connected” to “Connected” (no refresh)?
</ask_followup_question>

