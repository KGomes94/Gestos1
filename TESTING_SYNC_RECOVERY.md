Sync & Recovery Testing Checklist

Purpose
- Validate the persistent save queue, beforeunload snapshot, file creation fallback, and recovery UI.

Manual test steps

1) Simulate missing drive file and save
- Start app (ensure Drive emulation or set FILE_IDS[FILES.FINANCE] = null via console).
- Make a change that triggers a save (e.g., create a transaction).
- Verify that a local pending entry is created (open DevTools → Application → Local Storage → key: `db_pending_payloads_v1`).
- Confirm the app attempts to create the missing file and retries until success.

2) Simulate network failure during save
- Put network offline (DevTools) after creating/changing data.
- Make multiple changes; verify pending count increments and UI shows "Salvamentos pendentes: X" badge.
- Re-enable network: verify pending entries are uploaded, pending badge disappears, and notification shows success.

3) Close tab during pending save
- Make a change and quickly close the tab (or simulate via `beforeunload`).
- Reopen the app: verify that a notification or banner appears indicating recoverable pending changes (or the bottom-left recovery button is visible).
- Click "Recuperar" or wait: confirm pending changes are re-sent to the cloud.

4) Conflict scenario (remote newer)
- Simulate remote file change with later `lastSync` timestamp (via Drive API or by editing file in the cloud).
- Attempt to save local changes: the system should detect a conflict, set sync error, and not overwrite remote automatically. A manual resolution path is required (documented next steps).

Notes & Next steps
- Add an automated test harness (e2e) with Playwright to simulate offline/online and beforeunload flows.
- Add a small UI dialog to present conflict diffs to the user in a future iteration.

Files added/changed
- services/db.ts: persistent save queue, retries, local snapshot on unload, recovery APIs.
- App.tsx: pending count UI + recovery "Recuperar" button.
- TESTING_SYNC_RECOVERY.md: manual test plan.

If you'd like, I can now add automated e2e tests using Playwright (recommended) and a small conflict-resolution dialog in the UI.