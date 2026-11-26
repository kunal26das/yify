# Account privacy requests

[Back to README](../README.md)

Requests arrive by email at the support address: the app's **Request a copy of your data** row (You › Settings › Privacy) opens an email with the subject "Yify data request", and the privacy policy and the deletion page give the same address. Account deletion itself is self-service in the app (You › Settings › Account › Delete account); this tool is for access, portability and correction requests, and for deletion requests from people who can no longer use the app.

The local operator tool collects a Firebase account export and prepares an erasure review. It does not erase data, send email, cancel subscriptions, change permissions or claim to complete a GDPR or DPDP response. Its default mode is an offline simulation that uses no credentials and makes no network request.

```sh
node scripts/privacy/run.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/register.mjs --test tests/scripts/privacy-request-workflow.test.cjs
```

## Receiving and verifying a request

Keep a restricted request register outside GitHub issues, source control and shared logs. Record the receipt time, the requested right, the jurisdiction, the identity-verification decision, the assigned owner, the response deadline, processor follow-ups and the outcome. Use the signed-in account or a proportionate ownership check, such as a reply from the Google account's address; do not routinely collect ID scans or ask for passwords. A value in the request file records the operator's decision; the tool does not itself verify identity.

Respond without undue delay. For GDPR the tool calculates a one-calendar-month review date from receipt, clamping month ends. The operator checks the applicable deadline, legitimate identity questions and any justified extension; the tool never assumes an extension, and a permitted extension is explained within the first month. The seven-day internal review target is operational, not a statutory DPDP deadline. Keep the published DPDP grievance period within its applicable maximum of 90 days once that rule takes effect. The legal timing and sources are in the September 2026 readiness assessment: `git show v1-baseline:docs/privacy-readiness-20260925.md`.

## Read-only collection

Use a trusted workstation and a short-lived Google OAuth access token with only the reads the tool needs: `firebaseauth.users.get`, Firestore document get and list, and permission to list child collections. Review IAM restrictions before use; this is an administrative API and does not go through end-user Firestore rules. Use the Google cloud-platform scope. Do not create a long-lived service-account key for this workflow, and do not put tokens in command arguments, request files, screenshots or this repository.

Create a private request JSON file (mode `0600`) in a restricted directory outside the checkout. Its only allowed fields are:

```json
{
  "requestId": "PRIV-2026-0001",
  "project": "yify-2da67",
  "uid": "VERIFIED_FIREBASE_UID",
  "right": "access",
  "jurisdiction": "GDPR+DPDP",
  "receivedAt": "2026-11-27T10:00:00Z",
  "ownershipVerifiedAt": "2026-11-27T11:00:00Z"
}
```

Replace the sample identity and dates from the restricted register. Supported rights are `access`, `portability`, `erasure` and `correction`; jurisdictions are `GDPR`, `DPDP`, `GDPR+DPDP` and `other`. The accepted Firebase UID format matches the current alphanumeric IDs with underscores and hyphens. Other UID formats, Firebase Auth tenants or additional databases need a reviewed adapter change.

Supply `GOOGLE_ACCESS_TOKEN` through an approved secret mechanism and set `GOOGLE_CLOUD_PROJECT` to the project recorded in the request. Use an absolute output path outside every Git checkout and every directory that a web server serves or a cloud service synchronises. The tool rejects relative output paths and any destination with a `.git` file or directory among its ancestors, including linked worktrees and ignored folders inside a repository. It cannot discover every web-server or sync configuration, so the operator verifies those separately. The output's parent directory must exist, resolve without symlinks and be under the operator's control, and the output directory must not exist yet. These checks run before any live read and again before writing.

```sh
node scripts/privacy/run.mjs --live-read --request-file /private/request.json --out /private/request-export
```

The command creates a new `0700` directory with two `0600` files. `account-export.json` holds personal data, provenance and an erasure review manifest. `receipt.json` records counts, a SHA-256 digest, the collection time and a seven-day review date for purging the temporary export. Standard output contains only operational counts. Neither file belongs in source control, a pull request, analytics or a public support log. The tool does not encrypt the export, so keep it on encrypted storage with restricted access. The purge date is a reminder, not an automatic deletion job or an approved retention policy.

Any denied source, malformed result, looping pagination or exceeded limit stops the collection; the command never presents a truncated result as complete. The bounds are 5,000 documents, 64 MB of collected Firestore data, 20 nested collection levels, 100 pages per collection and 10,000 requests. Investigate a stop in a private operator session before rerunning, and never enable HTTP debug logging with live credentials or data.

## What is covered

| Source | Export |
| --- | --- |
| Firebase Authentication | Selected identity and profile fields, linked-provider identity, account state and timestamps. Password hashes, salts, session credentials, MFA recovery material and unrecognized fields are omitted. |
| `users/{uid}` | The Yify 1.x document: watchlist, history, library, preferences, their update stamps and the retired availability-alert enrollment, with each JSON string decoded next to the original typed fields. v2 reads it once for the import (and hourly while 1.8 devices change it) but never writes it. A v2-only account has none; the tool records it as missing and still traverses its children. |
| `users/{uid}/sections/{section}` | The v2 sync documents, one per section: `watchlist`, `diary` (dates, half-star ratings, notes, rewatches), `lists`, `recent`, `preferences` and `meta` (the v1 import record). Each has a canonical JSON `payload`, decoded in the export, and `schema: 1`. |
| Any other child collection | Every child collection under either root is listed and exported, whether or not the app knows it, so a leftover or future collection is never missed. |
| `journals/{uid}` | The Yify 1.x journal, or after a deletion the empty barrier (`deleting: true` with an empty payload) that stops stale clients restoring data. |

Each Firestore document includes its path and available revision timestamps. Reads are not a transaction, so data can change during collection. The export records its start and completion times and explicitly does not claim a consistent snapshot. Collect again where necessary before responding, and compare current revisions before any later mutation.

This covers the Firebase account roots, not every processor. The export lists the gaps it leaves:

- RevenueCat customer, aliases and purchase records, and Google Play billing records, need separate requests (RevenueCat dashboard or API; Google Play for its own records).
- Google Analytics for Firebase is keyed by an app instance ID, not the account; Sentry events carry no account ID; AdMob and its consent records belong to Google; EAS Update install IDs and EAS Hosting request logs belong to Expo. Crashlytics holds data only for installs still on 1.8.x.
- Support mail, backups and data kept only on a device (an unsynced library, recent searches, consent choices, caches and the cached Plus status) need separate assessment.

Never tell a requester that all their personal data has been exported because this command succeeded.

## Review, deliver and close

Review the bundle for third-party information, internal security material and applicable disclosure exceptions before preparing the requester's copy. A JSON file alone does not provide the purposes, recipients, legal basis, retention and other information an access response needs; the privacy policy and the processing register supply them. Explain gaps truthfully and follow up with the relevant processors. Deliver through a secure channel to the verified requester, not a public share link. Keep the response, processor receipts and the justified case record under an approved policy, then remove temporary exports and confirm the removal.

For erasure, the manifest is a review plan that follows the in-app deletion order (`docs/v2/SPEC.md` A6.7 while v2 is being built):

1. Establish the empty `journals/{uid}` deletion barrier (`deleting: true`, payload `{"version":1,"clearedAt":0,"entries":{}}`) before removing any content, so stale signed-in clients cannot restore it. The Firestore rules then deny reads and writes to everything but deletes.
2. Delete every `users/{uid}/sections/*` document and `users/{uid}`.
3. Delete the Firebase Auth user and revoke its sessions.
4. Delete the RevenueCat customer on request, and handle the other processors listed above.

Re-read revisions and use conditional writes for any separately approved mutation. Keep only justified data, with its restricted purpose, basis and review date. Deleting the barrier without solving stale-session restoration can recreate removed data. Account erasure does not cancel a Google Play subscription or grant a refund.

No live account collection or deletion was performed while building or testing this tool. Tests use synthetic records only.

API references: [Firestore list documents](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list), [Firestore list child collections](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds), [Firebase Auth administrative account lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup).
