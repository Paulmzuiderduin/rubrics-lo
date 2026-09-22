# Rubrics LO product backlog

Priorities reflect the pilot's most important risks and workflows. Keep this file as the source of truth when returning to deferred work.

## P0 — pilot safety and trust

- [x] Implement targeted, transactional entity changes so one small edit does not rewrite every class, lesson, and assessment (migration still needs deployment and runtime verification).
- [x] Reject a full-workspace save when it is based on an older remote version.
- [x] Keep failed saves in the open tab, warn before leaving, offer retry, and offer an explicit local download of unsaved data.
- [x] Replace raw database errors in the UI with privacy-conscious messages.
- [x] Add a short undo window after deleting a class or assessment.
- [ ] Apply and verify the compare-and-swap migration in the connected Supabase project.
- [ ] Verify isolation and save-conflict behavior with two real test accounts, using fictional data only.
- [ ] Confirm the Supabase backup plan, latest backup timestamp, and restore procedure; perform a restore drill in a separate project before real pupil data is allowed.
- [ ] Agree and publish retention/deletion periods with the school/controller before storing real pupil data.
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
