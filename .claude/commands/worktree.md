---
description: Create an isolated git worktree under .trees/ and run a task there independently
argument-hint: <task description>
---

Task requirement from the user:

$ARGUMENTS

Do the following:

1. **Pick a name**: derive a short kebab-case slug (2-4 words) that summarizes the requirement above (e.g. `add-pause-menu`, `fix-score-overflow`). This is `<name>`.

2. **Create the worktree** from the repo root:
   ```
   git worktree add .trees/<name> -b worktree-<name>
   ```
   If the branch or directory already exists, append a short numeric suffix to `<name>` and retry.

3. **Run the task independently**: spawn a `general-purpose` agent with `run_in_background: true`. The agent prompt must:
   - State its working directory is the absolute path to `.trees/<name>` and that ALL file reads/edits/commands must happen there (not the main repo checkout).
   - Include the full task requirement verbatim, with enough context for it to work without asking follow-up questions.
   - Instruct it to commit its work on branch `worktree-<name>` when finished, but NOT to push, merge, or open a PR.

4. Reply to the user with the worktree path, branch name, and a note that the agent is working in the background — do not poll or wait for it.
