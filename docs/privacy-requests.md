# Account privacy requests

The local operator tool collects a Firebase account export and prepares an erasure review. It does not erase data, send email, cancel subscriptions, change permissions or claim to complete a GDPR/DPDP response. No credentials or network requests are used by its default simulation.

```sh
node scripts/privacy/run.mjs
node --test tests/privacy-request-workflow.test.cjs
```

## Receiving and verifying a request

Keep a restricted request register outside GitHub issues, source control and shared logs. Record receipt time, requested right, jurisdiction, the identity-verification decision, assigned owner, response deadline, processor follow-ups and outcome. Use the existing signed-in account or a proportionate ownership check; do not routinely collect ID scans or ask for passwords. A value in a configuration file records the operator's decision; the tool does not itself verify identity.

Respond without undue delay. For GDPR, the tool calculates a one-calendar-month review date from receipt, clamping month ends. An operator must check applicable deadline calculation, legitimate identity questions and any justified extension; the tool never assumes an extension. Explain a permitted extension within the first month. The seven-day internal review target is operational, not a statutory DPDP access deadline. Keep the published DPDP grievance period within its applicable maximum of 90 days when that rule takes effect. See the legal timing and sources in [the readiness assessment](privacy-readiness-20260925.md).

## Read-only collection

Use a trusted workstation and a short-lived Google OAuth access token with only the required reads: `firebaseauth.users.get`, Firestore entity get/list, and permission to list child collections. Review IAM restrictions before use; this is an administrative API and does not rely on end-user Firestore rules. Use the Google cloud-platform scope. Do not create a long-lived service-account key for this workflow. Do not put tokens in command arguments, request files, screenshots or this repository.

Create a private request JSON file (mode `0600`) in a restricted directory, preferably outside the checkout. Its only allowed fields are:

```json
{
  "requestId": "PRIV-2026-0001",
  "project": "yify-2da67",
  "uid": "VERIFIED_FIREBASE_UID",
  "right": "access",
  "jurisdiction": "GDPR+DPDP",
  "receivedAt": "2026-09-25T10:00:00Z",
  "ownershipVerifiedAt": "2026-09-25T11:00:00Z"
}
```

Replace the sample identity and dates using the restricted register. Supported rights are `access`, `portability`, `erasure` and `correction`; jurisdictions are `GDPR`, `DPDP`, `GDPR+DPDP` and `other`. The Firebase UID format accepted by this tool matches Yify's current alphanumeric IDs with underscores/hyphens. Other UID formats, Firebase Auth tenants or additional databases need a reviewed adapter change.

Supply `GOOGLE_ACCESS_TOKEN` through an approved secret mechanism and set `GOOGLE_CLOUD_PROJECT` to the same project recorded in the request. Use an absolute output path outside every Git checkout and every directory served by a web server or synchronized to a shared location. The tool rejects relative output paths and any destination with a `.git` file or directory in its ancestry, including linked worktrees and ignored folders inside a repository. It cannot discover all web-server or cloud-sync configurations, so the operator must verify those separately. The output's parent directory must exist, resolve without symlink components, and be under the operator's control. The output directory must not already exist. These checks run before any live account reads and again before writing.

```sh
node scripts/privacy/run.mjs --live-read --request-file /private/request.json --out /private/request-export
```

The command creates a new `0700` directory and two `0600` files. `account-export.json` contains personal data, provenance and an erasure review manifest. `receipt.json` records counts, a SHA-256 digest, collection time and a seven-day temporary-file purge review date. Standard output contains only operational counts. Neither file belongs in source control, a PR, analytics or public support logs. Export storage is not encrypted by this tool; use encrypted storage and restricted access. The purge date is a review reminder, not an automatic deletion job or an approved retention policy.

Any denied source, malformed result, looping pagination or exceeded limit stops the collection; the command does not present a truncated result as complete. The configured bounds are 5,000 documents, 64 MB of collected Firestore data, 20 nested collection levels, 100 pages per collection and 10,000 requests. Investigate the cause in a private operator session before rerunning. Do not enable HTTP debug logging with live credentials or data.

## What is covered

| Source | Export |
| --- | --- |
| Firebase Authentication | Selected identity/profile fields, linked-provider identity, account state and timestamps. Password hashes, salts, session credentials, MFA recovery material and unrecognized fields are omitted. |
| `users/{uid}` | Complete stored Firestore fields, including watchlist, viewing history, library, preferences and availability enrollment, with readable decoded JSON alongside the original typed fields. |
| `journals/{uid}` | The complete journal payload and any nested documents. All pages are traversed, including child documents under a missing parent; this is independent of what the app UI has loaded. |
| `availabilityAlertState/{uid}` | Delivery state and nested documents for that exact UID, even when the person is no longer in the current pilot allowlist. The shared `_cache` is excluded. |

Each Firestore document includes its path and available revision timestamps. Reads are not a transaction, so data may change during collection. The export records its start and completion times and explicitly does not claim a consistent snapshot. Re-collect where necessary before issuing the response, and compare current revisions before any subsequent mutation.

This covers known Firebase account roots, not every processor or historical schema. RevenueCat aliases and transactions; Play/App Store/Stripe billing; Firebase Analytics and Crashlytics; Sentry; AdMob/AdSense/CMP; support email; backups; hosting logs; device-local data and consent receipts require separate inventory, access/export/erasure assessment and processor evidence. Unknown Auth fields also require review where relevant. Do not tell a requester that all personal data has been exported because this command succeeded.

## Review, deliver and close

Review the bundle for third-party information, internal security material, push delivery tokens and applicable disclosure exceptions before preparing the requester-facing copy. A JSON download alone does not supply the purposes, recipients, legal basis, retention and other information required in an access response. Explain gaps truthfully and follow up with the relevant processors. Deliver through a secure channel to the verified requester; do not publish a share link by default. Retain the response/processor receipts and justified case record under an approved policy, then remove temporary exports and verify their removal.

For erasure, the included manifest is a review plan. Establish the empty immutable `journals/{uid}` deletion barrier before removing synchronized content, so stale signed-in clients cannot restore it. Stop alert delivery and explicitly examine the UID's worker state even outside the pilot allowlist. Re-read revisions and use conditional writes for any separately approved mutation. Preserve only justified data with its restricted purpose, basis and review date; deleting the barrier without solving stale-session restoration can recreate removed data. Complete authentication/session and processor actions separately and retain their receipts. Account erasure does not cancel store subscriptions or automatically grant refunds.

No live account collection or deletion was performed while implementing or testing this tool. Tests use synthetic records only.

API references: [Firebase list documents](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list), [Firebase list child collections](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds), [Firebase Auth administrative account lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup).
