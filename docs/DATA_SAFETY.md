# Data safety: pilot checklist and decisions

The app can technically store pupil names and formative assessments, but a teacher account is not a substitute for the school's authorization and privacy arrangements. Use synthetic records for access-control tests; do not use a live class for destructive tests.

## Verify access isolation with real test accounts

Use two separate, verified email accounts that you control, each in a separate browser profile (or one normal window and one private window). Do not use actual pupil names or results during this check.

1. Do not edit or delete any existing class. Sign in as Account A and create a disposable class named `TEST-ISOLATION-A`, add invented names, and save one test assessment. Wait until the app says it is saved.
2. Open a second browser profile and sign in as Account B. It may already have its own data; confirm specifically that `TEST-ISOLATION-A` and its invented records do not appear.
3. In Account B, create a different disposable class named `TEST-ISOLATION-B`. Return to Account A and refresh: `TEST-ISOLATION-B` must not appear.
4. In both profiles, check Classes, Results, Reports, and the lesson agenda for cross-account leakage. The rubric library is global and is expected to be the same for both accounts.
5. With Account A open in two tabs, save a change in Tab 1. Then try to save a different change from the older Tab 2. Tab 2 must show a save conflict and keep its edits available for download; it must not replace Tab 1's newer data. A save request that times out has an uncertain result, so reload the saved version before retrying.
6. Use the delete/undo action only on a synthetic assessment and disposable test class. Confirm the item can be restored during the 10-second undo window; after that window, it is intentionally deleted.
7. Sign out of both accounts. Attempt to load the app without a session: the private workspace and all pupil data must remain inaccessible.
8. Remove only the `TEST-ISOLATION-*` data after the check. If a check fails, stop expanding use of the app, preserve existing records, and contact the school's privacy/IT lead; do not use the real class to troubleshoot or delete data.

Keep screenshots or notes of the expected/actual results, but redact names, email addresses, tokens, and other secrets.

## Migration and authorization prerequisites

- The `protect_workspace_snapshot_writes` and `retire_legacy_workspace_writer` migrations are applied to the connected Rubrics Supabase project.
- The old `save_personal_workspace_snapshot` writer has been revoked for `public`, `anon`, and `authenticated`; it remains in the database only as a non-callable rollback artifact. The current client uses the revision-checked patch writer.
- The matching frontend has been pushed and the GitHub Pages workflow completed successfully. The user has reported that separate Account A and Account B do not see each other's workspace, and that an older same-account tab did not replace Safari's newer saved class name. That stale tab remained stuck showing “Saving…”. A 20-second abort-and-reload safeguard is now deployed; repeat the two-tab case once to verify that it exits the saving state and asks you to reload the latest version. This user-reported UI test is not a substitute for direct API/RLS tests.
- Never run a production database reset to apply it. Confirm the project reference before any further live migration.
- The save RPC must derive the workspace owner from the authenticated user's `auth.uid()`; never add a caller-provided owner ID.
- RLS is only verified after the real-account isolation check. A hidden UI control is not an authorization test.
- Keep the Supabase service-role/secret key out of the browser, Git, screenshots, shell history, and shared test notes.

The live project check confirmed that both public workspace RPCs use `SECURITY INVOKER`, `load_personal_workspace_snapshot` and `apply_personal_workspace_changes` are executable by `authenticated` but not `anon`, and the legacy save RPC is no longer executable by `authenticated` or `anon`. The internal row-patch helper cannot be called directly by `authenticated`. All public application tables have RLS enabled; policy presence alone does not prove account isolation, so preserve the two-account browser check.

The Supabase project is on the Free plan and the dashboard currently shows no managed backup. Leaked-password protection is also disabled; Supabase documents that feature as Pro-plan-and-above, so enabling it would require a plan change. No plan upgrade or paid add-on has been made.

## Backups and recovery

Because pupil data is already present, treat this as an immediate operational gap to resolve before expanding use or relying on the app as the only copy:

1. In Supabase Dashboard, open **Database → Backups** and confirm the plan, most recent successful backup, and available retention window for this specific project.
2. If the project is on a plan without managed daily backups, establish a scheduled encrypted logical export to a separate protected location; do not treat GitHub or a developer laptop as the sole backup.
3. Restore a backup into a separate test project and verify classes, assessments, rubric versions, access policies, and auth behavior. Never rehearse restoration over the live pilot project.
4. Write down the recovery owner, access path, restore steps, expected data-loss window, and a date for the next restore drill.
5. Remember database backups do not include Supabase Storage objects. This pilot currently keeps rubric content in code and pupil data in Postgres, but revisit this if media uploads are added.

Supabase documents daily backups for Pro, Team, and Enterprise projects (with plan-specific retention), while Free projects should maintain their own exports. Verify the current project plan rather than assuming which protection applies. See [Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups).

## Retention proposal — school/controller decision required

There is no one-size-fits-all legal retention duration for these assessment records. The school is normally best placed to determine the purpose and required duration; confirm it with the school's privacy officer/data protection officer before production use. The [Dutch Data Protection Authority's guidance](https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens) says organizations must set a purpose-based period, disclose it, and delete or anonymize data when it is no longer needed.

The app is currently being used with pupil data, so treat class rosters and assessments as personal data. The following is a concrete proposal for the school/controller to review; it is not a legal determination and must not be represented as school policy until approved:

- **Pupil roster, rubric assessments, teacher adjustments, and lesson links:** retain during the school year only while needed for teaching feedback. At class/year rollover, transfer only school-approved information to the authoritative school system; proposal: purge identifiable app records no later than 90 days after the school year ends. Do not keep multi-year identifiable history by default; require a documented teaching purpose and school approval if it is needed.
- **Teacher account and workspace:** retain while the teacher is authorized to use the pilot. On role departure, pilot closure, or a verified deletion request, export only if the school requires it and then delete the account/workspace. The database has cascading foreign keys from account to workspace and its classes, but the app has no account-deletion flow yet.
- **Exports:** treat CSV, PDF, and JSON files as separate personal-data copies. Keep them only in a school-approved location and delete them by the same approved end date; personal Downloads or consumer cloud drives are not an approved archive by default.
- **Security/operational logs:** retain only the minimum necessary to investigate access and reliability issues; do not log pupil names, rubric responses, access tokens, or full request payloads.
- **Backups:** Supabase Free does not include automatic database backups. If a school-approved encrypted off-site export is established, a proposed rolling 30-day expiry gives a finite window for copies of deleted rows to expire; a live-row deletion does not instantly erase older backup copies. Test restore only in a separate project. No backup destination or restore drill is currently configured.

The app does not yet automate retention or account-wide deletion. The proposed 90-day post-school-year purge and 30-day backup expiry are not implemented and remain subject to school/controller approval. Before treating either as policy, record the purpose, legal basis, accountable owner, exact calendar trigger, exceptions, deletion method, and how the schedule is disclosed. The school should also decide whether the school's official system (for example, Magister) remains the authoritative long-term record and this app holds only the current teaching-period copy.
