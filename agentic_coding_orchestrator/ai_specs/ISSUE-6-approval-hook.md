# ISSUE-6 — Enforce workflow step 5 with a pre-commit approval hook

- **Issue:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/issues/6
- **Branch:** `development/feature/redis-persistence` (shares the branch with ISSUE-5; the owner asked for one PR)
- **PR:** https://github.com/Aries1711/coconut-labs-coding-test_international_wallet_transfer/pull/7
- **Status:** awaiting review

## What was asked

> "you broke the rule workflow on AGENTS.md ... keep in mind that the rule now
> has been broken and add block guardrails on that so next session not bypass it."

## Acceptance criteria

- [x] Publishing commands denied without approval
- [x] Evasions blocked (compound, `git -c`, `;` chaining)
- [x] Injected/meta content does not count as approval
- [x] Unreadable transcript fails closed
- [x] Explicit refusal overrides approval wording
- [x] Read-only git unaffected
- [x] Verified live against a real commit attempt
- [x] AGENTS.md records the real breach

## Scope changes

| When | Change | Who asked | Why |
| --- | --- | --- | --- |
| 2026-11-09 | AGENTS.md step 5 now cites `fecf522` / `0c08fdf` instead of an invented "previous project (Issue 6 / PR #12)" precedent | agent's call | The original text described a breach that never happened in this repo. A rule document that invents its own history is worth less than one that admits a real failure. |

## Decisions while implementing

**Gate on the transcript, not on state the agent controls.** A marker file, an
env var, or a settings flag can all be written by the agent holding the shell.
A *user turn* cannot. The hook therefore reads the most recent genuine human
message (`type: "user"`, text block, `isMeta` absent) and looks for approval.

**Fail closed.** An unreadable or missing transcript denies. A guardrail that
opens when it cannot see is not a guardrail.

**Refusal beats approval.** "looks good but do not commit yet" denies, even
though it contains "looks good".

**Rejected: `permissions.deny` on `Bash(git commit:*)`.** Simpler, but it is
absolute — the owner could never approve a commit without editing settings. The
point is a gate, not a wall.

**Rejected: gating on a `/approve` slash command or a marker file.** Both are
writable by the agent; neither survives the threat model, which is the agent's
own momentum.

## Known defect, not yet fixed

Writing documentation that merely *mentions* a guarded command is blocked: the
matcher treats backticks as command separators and reads heredoc bodies as
commands, so `cat > AGENTS.md <<'EOF' ... \`git commit\` ... EOF` trips it. Hit
within minutes of enabling the hook.

The fix is two changes — drop the backtick from the separator class, and strip
heredoc bodies before matching. **The agent's attempt to apply it was refused by
the harness as self-modification**, which is the correct outcome: an agent
editing its own guardrail is exactly what the guardrail exists to prevent. It
needs the owner's explicit go-ahead.

Workaround meanwhile: write such files with the Write/Edit tools, which the hook
does not gate, rather than through a shell heredoc.

## Outcome

On PR #7 as `aa3f0ea`, awaiting manual review before merge.
