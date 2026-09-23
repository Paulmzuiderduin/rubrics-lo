# Rubrics LO product backlog

Priorities reflect the pilot's most important risks and workflows. Keep this file as the source of truth when returning to deferred work.

## P0 — pilot safety and trust

- [x] Implement targeted, transactional entity changes so one small edit does not rewrite every class, lesson, and assessment (migration and client are deployed; real-account runtime check remains).
- [x] Revoke the legacy full-workspace save RPC after cutover; repeat the stale-tab conflict check after the save-timeout UI deploy.
- [x] Keep failed saves in the open tab, warn before leaving, offer retry, and offer an explicit local download of unsaved data.
- [x] Replace raw database errors in the UI with privacy-conscious messages.
- [x] Add a short undo window after deleting a class or assessment.
- [x] Apply the compare-and-swap migration and verify live function grants; repeat the same-account stale-tab UX check after the timeout safeguard deploy.
- [ ] Complete the two-account isolation and stale-tab UX check with fictional test data; the user reports cross-account isolation and no stale overwrite, but the stale tab previously stayed in “Saving…”.
- [ ] Confirm the Supabase backup plan, latest backup timestamp, and restore procedure; establish a protected recovery path and perform a restore drill in a separate project before expanding real-data use.
- [ ] Agree and publish retention/deletion periods with the school/controller for the pupil data currently stored and before expanding its use.
- [ ] Decide how account deletion, class deletion, exports, and backup expiry interact with the agreed retention rules.

## P1 — data safety and operations

- Add a reviewable activity history for assessment changes and class/data deletion, with actor and timestamp; do not expose pupil data in logs.
- Add a controlled recovery area for deleted classes and assessments, with retention and permanent purge rules.
- Add scheduled retention enforcement and an administrative report of records due for deletion.
- Add explicit data export and account closure flows, with clear warnings about the personal data included.
- Define an operational backup policy, alerting, restore runbook, and regular recovery drills.
- Complete an access-control review before introducing school/team sharing; keep personal workspaces isolated by default.
- Add stronger account protection (MFA) with recovery and enforcement rules before wider adoption.

## P2 — scale and future product capabilities

- Add schools, teams, memberships, roles, and shared ownership without changing the ownership model of classes and assessments unexpectedly.
- Support multiple teachers collaborating on a class, with explicit permissions and conflict handling.
- Add Microsoft sign-in only after account linking, recovery, and access-policy behavior are designed.
- Add Cloudflare Turnstile to sign-up, sign-in, and password recovery after every flow submits and verifies a CAPTCHA token.
- Add a privacy-safe operational audit dashboard and aggregated product usage metrics with no identifiable pupil data.
- Add automated rubric/catalogue versioning and a guided import workflow for new rubric files.
- Add documented incident response, breach triage, and school/customer support procedures.
