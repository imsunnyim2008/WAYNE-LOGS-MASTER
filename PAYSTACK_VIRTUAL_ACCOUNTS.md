# WAYNE LOGS — dedicated bank accounts (Paystack)

## Current release state

**Disabled by default.** The new Wallet → Personal Transfer Account panel does not issue any account until the operator's approved Nigerian business can use Paystack Dedicated Virtual Accounts (DVA).

This is a merchant **payment collection** feature, not a personal bank account product, a withdrawal service, or a service for transferring customers' funds to outside banks. Customer payments go to the merchant's Paystack account, and the application records verified wallet/store credit. Existing internal WAYNE ID credit transfers remain unchanged.

## Prerequisites BEFORE enabling

1. Registered Nigerian business and a live, verified Paystack merchant account. Check that the merchant account is eligible for DVAs and that **all WAYNE LOGS products/business activities** are permitted by Paystack and relevant third-party platforms; seek written approval if uncertain.
2. Complete Paystack go-live and, when applicable, category-specific KYC/identity validation. The app deliberately **does not collect BVN/NIN**; if the merchant category requires it, integrate a provider-approved secure identity-verification flow before enabling production DVA issuance.
3. Confirm supported banks and provider transaction fees with Paystack; request additional DVA quota if needed.
4. Use Paystack **test mode first**. Set the test key in Render Environment (never in JavaScript/GitHub/chat), and set **PAYSTACK_DVA_ENABLED=true** only for a controlled test environment.
5. Configure the Paystack Dashboard webhook to point to:
   `https://wayne-logs-master-api.onrender.com/api/wallet/webhooks/paystack-dva`
   If other Paystack products are active on the same merchant account, **consolidate their webhooks first**: this endpoint handles only dedicated-account assignment and DVA wallet funding; it does not fulfill unrelated purchase charge events.
6. Confirm signed `dedicatedaccount.assign.success` events; only then display bank name, account name, and the actual 10-digit NUBAN. Do not give customers example or test numbers as real transfer destinations.
7. Test signed `charge.success` with server-to-server transaction verification. The backend verifies the incoming transfer channel, currency, credited amount, recipient account number, and the customer's email, then records **one atomic transaction per Paystack reference**.
8. Test duplicated, delayed, rejected and forged webhooks; investigate charges, reversals and disputes. Consider cash-flow exposure and provider fees before enabling live customer credits.
9. Switch the server secret to a **live** Paystack key and enable the flag only after all above steps pass and the merchant is approved.

## Render environment configuration

| Variable | Default | Description |
| --- | --- | --- |
| PAYSTACK_DVA_ENABLED | `false` | Feature gate; false until merchant is approved |
| PAYSTACK_SECRET_KEY | unset | Secret Paystack key; server only |
| PAYSTACK_DVA_BANK | `titan-paystack` | Preferred supported bank (test key automatically uses `test-bank`) |

Do not set test and live keys at the same time on one environment.

## Safety / reconciliation

- An authenticated, email-verified customer must explicitly consent before their registered name/email/phone is shared with Paystack.
- Each WAYNE LOGS user can create only one request; the bank details are displayed **only after the provider verifies assignment**.
- A client POST never credits money. Only a signed Paystack webhook, independently re-verified by the Paystack transaction API and matched to the assigned bank account, can credit a wallet.
- Customer balances and credit ledger are committed in one MongoDB transaction. Duplicate references cannot credit a wallet twice.
- The feature does not permit cash withdrawal, outgoing NIP bank transfers, or charging third-party accounts. Such features require a separate approved payouts/compliance integration.
- DVA credits may be affected by chargebacks/reversals; configure financial reconciliation and a support procedure before broad production use.
