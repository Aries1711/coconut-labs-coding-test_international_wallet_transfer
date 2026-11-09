# Agentic coding orchestrator

The working record of how this project was built: decisions, verification, corrections and specifications, written as the work happened rather than reconstructed afterwards.

The code and git history already show _what_ was built. These folders exist for what they cannot show — why an approach was chosen, what was tried and rejected, what broke and why, and which decisions came from the project owner rather than the agent.

## Folders

| Folder        | Holds                                                                              | Written when                                                 |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ai_docs/`    | Durable design documents — the technical plan, schema and algorithm design         | When the design is created or changes                        |
| `ai_specs/`   | One file per issue, tracking it from creation through scope changes to merge       | Created with the GitHub Issue, updated on every change       |
| `ai_reviews/` | Acceptance test runs — what was executed, what passed, what failed, what was fixed | After each verification pass, before handing over for review |
| `ai_logs/`    | Dated log of decisions, corrections and mistakes                                   | As they happen                                               |
| `ai_product/` | Product knowledge — what the thing is for, its vocabulary, journeys and product calls | When product intent is established or changes              |

## What to write, and what not to

**Write** the things a future reader cannot reconstruct:

- A decision and the alternative that was rejected, with the reason
- A defect found, its root cause, and how it was fixed
- A scope change and who asked for it
- An acceptance criterion that failed, and what that revealed

**Do not write** a narration of every command, a restatement of the diff, or anything already obvious from the code. These files are signal, not transcript. A reader skimming them should learn something the repository does not already say.
