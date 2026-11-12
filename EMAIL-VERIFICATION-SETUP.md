# WAYNE LOGS — Phase 1: email verification and My Orders reliability

## What this change adds

- An optional, secure **new customer** email verification flow, disabled until explicitly enabled in Render.
- 32 random-byte, single-use verification links. Only SHA-256 token hashes are stored in MongoDB.
- Links expire in 24 hours; resend requests enforce a two-minute account cooldown and an IP rate limit.
- The verification link token is kept in the URL fragment and removed from browser history after page load.
- Login and protected API access reject unverified customer accounts.
- Existing customers retain their account access; legacy users default to verified.
- When verification is enabled, **changing a verified email in Profile is blocked** pending a separate secure email-change flow; use support instead.
- My Orders now shows a **Try Again** action if loading fails, never reuses cached order results, redirects expired sessions to login, and safely handles clipboard restrictions.

## How to enable when ready

1. Deploy the PR to a staging environment and run the tests below.
2. Set up working SMTP credentials in the **Render backend environment**, not in GitHub or frontend code:
   `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optionally `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`.
3. Send and receive a real test email using the configured SMTP sender before enabling the feature.
4. In Render, set `REQUIRE_EMAIL_VERIFICATION=true` for the backend service, then redeploy.
5. Verify production links resolve to `https://www.waynelogs.com/verify-email.html`.
6. Create a **new test customer**. Registration should require clicking the emailed link, and login must fail until verification completes.
7. Check resending, token expiration, one-time usage, spam-folder delivery and the account lockout/error paths.

If `REQUIRE_EMAIL_VERIFICATION=true` but SMTP isn't configured, **new registration fails closed** rather than granting an unverified login. Leaving the flag unset or false preserves existing signup behavior. The feature never requests or stores SMTP credentials in the browser.

## Test locally

From `server/`, run:

```sh
npm ci
npm test
```

The added `tests/email-verification.test.js` covers token randomness, format validation, hashing, and expiration. Also run manual end-to-end tests against a **staging MongoDB and staging SMTP**, not real customer wallets.

## Still to implement in subsequent releases

- Secure self-service email changes (currently blocked when email verification is enabled).
- Email delivery health monitoring and delivery retry queue.
- End-to-end integration tests against a test database, checkout and wallet regression tests.
- Payment automation rollout and ULTRON live customer support testing.

Avoid merging and deploying directly to a live store until registration, login, order, and payment workflows have been tested.
