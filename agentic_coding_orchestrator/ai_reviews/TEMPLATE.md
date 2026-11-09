# ISSUE-<n> — acceptance run

- **Issue:** <link>  ·  **Branch:** `development/feature/<slug>`
- **Run on:** <date>, commit <sha>
- **Result:** <n> passed, <n> failed

## Criteria

Every acceptance criterion from the issue, with the command actually run and
its real output.

| # | Criterion | Command | Result |
| --- | --- | --- | --- |
| 1 | ... | `npm test` | PASS |

## Failures and fixes

For each failure: what failed, the **root cause**, and what changed to fix it.
Delete this section only if there genuinely were none — and say so in Result.

## Not covered

What this run did not exercise, and why. Be specific: "no browser automation
available, so the responsive layout was checked by markup inspection, not a
screenshot" is useful; "some edge cases untested" is not.
