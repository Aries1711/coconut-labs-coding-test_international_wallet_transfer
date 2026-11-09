#!/usr/bin/env python3
"""Enforce AGENTS.md step 5: verify, then STOP and hand over for review.

Blocks `git commit`, `git push`, `gh pr create/merge` and friends unless the
most recent *human* message in the transcript approves it.

Why the transcript: the agent cannot author a user turn, so it cannot grant
itself approval the way it could by touching a marker file or exporting an
environment variable. This is a guardrail against drift, not an adversarial
sandbox -- an agent with shell access could still edit the transcript on disk.
"""

import json
import re
import sys

# Actions that publish work and therefore need a human to have said so.
GUARDED = re.compile(
    r"""(?x)
    (^|[;&|`(]|\s)\s*
    (
        git(\s+-[^\s]+(\s+[^\s]+)?)*\s+(commit|push|merge|tag)\b
      | gh\s+(pr\s+(create|merge|ready)|release\s+create|repo\s+create)\b
      | npm\s+publish\b
    )
    """
)

# A human saying yes. Deliberately explicit -- "ok" or "nice" is not approval.
APPROVES = re.compile(
    r"""(?ix)
    \b(
        approved? | approve\s+(this|it|that) | lgtm | ship\s+it
      | go\s+ahead | looks?\s+good
      | (please\s+)?(commit|push|merge)\s+(it|this|that|them|and|now|the)
      | (create|open|raise|make)\s+(the\s+|a\s+)?pr\b
      | merge\s+(it|this|the\s+pr)
    )\b
    """
)

# An explicit no wins over any yes in the same message.
REFUSES = re.compile(
    r"(?i)\b(do\s*n[o']?t|don't|never|no)\s+(commit|push|merge|open\s+a\s+pr)\b"
)

TAG_BLOCK = re.compile(
    r"<(system-reminder|ide_opened_file|ide_selection|local-command-[a-z-]+|"
    r"command-[a-z-]+)>.*?</\1>",
    re.S,
)


def latest_human_message(transcript_path):
    """The most recent genuine user prompt: not a tool result, not injected."""
    latest = None
    try:
        with open(transcript_path, encoding="utf-8") as handle:
            for line in handle:
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if entry.get("type") != "user" or entry.get("isMeta"):
                    continue
                content = entry.get("message", {}).get("content")
                if isinstance(content, str):
                    latest = content
                    continue
                if not isinstance(content, list):
                    continue
                texts = [
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                ]
                if texts:  # a tool_result-only turn is not a human speaking
                    latest = "\n".join(texts)
    except OSError:
        return None
    return latest


def deny(reason):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    sys.exit(0)


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        sys.exit(0)  # never block on a malformed payload

    command = (payload.get("tool_input") or {}).get("command") or ""
    if not GUARDED.search(command):
        sys.exit(0)

    message = latest_human_message(payload.get("transcript_path") or "")
    if message is None:
        deny(
            "AGENTS.md workflow step 5: could not read the transcript to confirm "
            "approval, so this publishing command is blocked. Hand the work over "
            "for review and let the user approve explicitly."
        )

    cleaned = TAG_BLOCK.sub(" ", message)

    if REFUSES.search(cleaned):
        deny(
            "The user's most recent message explicitly says not to do this. "
            "Stop and hand the work over instead."
        )

    if not APPROVES.search(cleaned):
        deny(
            "BLOCKED by AGENTS.md § Workflow step 5 (STOP, hand over for review).\n\n"
            "The most recent user message does not approve publishing. Do NOT "
            "commit, push, or open a PR yet.\n\n"
            "Instead: post the verification results and state plainly that "
            "nothing is committed and you are awaiting review. Wait for the user "
            "to reply.\n\n"
            "This step is breached most often when the work went well -- a clean "
            "verification table feels like a finish line, but it is the point to "
            "hand over. The user unblocks this by replying with approval "
            '(e.g. "approved", "go ahead", "create the PR").'
        )

    sys.exit(0)  # approved


if __name__ == "__main__":
    main()
