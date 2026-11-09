# ai_reviews

Acceptance runs: what was executed, what passed, what failed, and how each
failure was fixed. Written after a verification pass, **before** handing over
for review.

Name per-issue runs `ISSUE-<n>-acceptance.md` (use `TEMPLATE.md`). Broader
sweeps keep a descriptive name — see `acceptance-run-1.md` (API + pages) and
`unit-test-run-1.md` (the unit suite and its test points).

**A review recording only passes is not worth keeping.** The entries that earn
their place are the criteria that failed, with the root cause and the fix. Copy
real command output; never paraphrase a result you did not see.
