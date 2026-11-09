# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md)** for the full operating instructions: stack,
commands, repository layout, workflow, backend and frontend conventions, domain
rules and known gotchas.

That file is the single source of truth, kept vendor-neutral so every agent
reads the same instructions. This file exists so Claude Code loads them
automatically.

Two things worth loading early, both referenced from `AGENTS.md`:

- [`agentic_coding_orchestrator/ai_docs/architecture.md`](agentic_coding_orchestrator/ai_docs/architecture.md)
  — the layering convention. Read before writing code.
- `AGENTS.md` § *Workflow - follow strictly* — in particular **step 5**: verify,
  then stop and hand over. Do not commit, and do not open a PR, until the user
  says so.

The original coding-test brief this project was built from is preserved at
[`agentic_coding_orchestrator/ai_docs/original-brief.md`](agentic_coding_orchestrator/ai_docs/original-brief.md).
