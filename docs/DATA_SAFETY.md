# Data safety: pilot checklist and decisions

This pilot should use fictional pupil data until the school has approved the privacy and retention arrangements. A teacher account is not a substitute for school authorization to process pupil data.

## Verify access isolation with real test accounts

Use two separate, verified email accounts that you control, each in a separate browser profile (or one normal window and one private window). Do not use actual pupil names or results during this check.

1. Sign in as Account A. Create a class named `TEST-ISOLATION-A`, add fictional names, and save one test assessment. Wait until the app says it is saved.
2. Open a second browser profile and sign in as Account B. Its class list and results must be empty; `TEST-ISOLATION-A` and its fictional records must not appear.
3. In Account B, create a different class named `TEST-ISOLATION-B`. Return to Account A and refresh: Account A must still only see its own class.
4. In both profiles, open Results, Reports, the lesson agenda, and the rubric library. Confirm that account B never sees account A's class, student names, assessment, or report.
5. With Account A open in two tabs, save a change in Tab 1. Then try to save a different change from the older Tab 2. Tab 2 must show a save conflict and keep its edits available for download; it must not replace Tab 1's newer data. A save request that times out has an uncertain result, so reload the saved version before retrying.
6. In Account A, use the delete/undo action on a fictional assessment and class. Confirm the item can be restored during the 10-second undo window; after that window, it is intentionally deleted.
7. Sign out of both accounts. Attempt to load the app without a session: the private workspace and all pupil data must remain inaccessible.
8. Remove all `TEST-ISOLATION-*` data after the check. Do not proceed with real pupil data if any step fails.

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

Before real pupil data is allowed:

1. In Supabase Dashboard, open **Database → Backups** and confirm the plan, most recent successful backup, and available retention window for this specific project.
2. If the project is on a plan without managed daily backups, establish a scheduled encrypted logical export to a separate protected location; do not treat GitHub or a developer laptop as the sole backup.
3. Restore a backup into a separate test project and verify classes, assessments, rubric versions, access policies, and auth behavior. Never rehearse restoration over the live pilot project.
4. Write down the recovery owner, access path, restore steps, expected data-loss window, and a date for the next restore drill.
5. Remember database backups do not include Supabase Storage objects. This pilot currently keeps rubric content in code and pupil data in Postgres, but revisit this if media uploads are added.

Supabase documents daily backups for Pro, Team, and Enterprise projects (with plan-specific retention), while Free projects should maintain their own exports. Verify the current project plan rather than assuming which protection applies. See [Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups).

## Retention proposal — decision required

There is no one-size-fits-all legal retention duration for these assessment records. The school is normally best placed to determine the purpose and required duration; confirm it with the school's privacy officer/data protection officer before production use. The [Dutch Data Protection Authority's guidance](https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens) says organizations must set a purpose-based period, disclose it, and delete or anonymize data when it is no longer needed.

Suggested starting point for discussion (not a legal determination):

- **Pilot with fictional data:** delete test classes and assessments at the end of the pilot; retain no identifiable test records beyond 30 days after pilot close.
- **Real pupil records:** before entry, have the school/controller approve a purpose and exact schedule. A reasonable proposal to take to that discussion is: retain the current school-year roster and assessment history while needed for teaching feedback; at year-end, export only what the school needs, delete the class roster and unnecessary history within 90 days, and retain longer only when the school documents a specific reporting/continuity need. Do not enable real pupil data based on this proposal alone.
- **Teacher account and class roster:** remove or export on account closure, role departure, or class-year rollover according to the school's decision. Do not leave former pupils indefinitely in an account by default.
- **Security/operational logs:** retain only the minimum necessary to investigate access and reliability issues; do not log pupil names, rubric responses, access tokens, or full request payloads.
- **Backups:** document how long deleted records can remain in backups and how expiry works. A live-row deletion does not instantly erase older backup copies.
- **Exports:** treat downloaded CSV/PDF/JSON files as copies of personal data; assign an owner and deletion date, and store them only in approved locations.

The app does not yet automate retention or account-wide deletion. Do not describe a retention period as implemented until scheduled deletion, backup expiry, export handling, and account closure behavior are all verified. For the present Free-plan pilot, the first retention decision is to use fictional data only and manually purge test records at pilot close (within 30 days); a real-data schedule remains for the school/controller to approve.
