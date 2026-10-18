# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## Epics and phased work

Multi-phase work (several stacked PRs) is tracked as one **epic** issue plus one **phase** issue per PR. Use GitHub's native relationships, not only text. The task list and `Part of #<epic>` line stay as a human-readable fallback.

Layout:

- **Epic**: title `Epic: <name>`, label `enhancement`. Body sections: Why, Goals, Non-goals, Decisions (agreed), Design summary, Constraints, Phases (task list of `- [ ] #<n> <title>`), Stacked PR workflow. Never put personal data (email addresses, secrets) in issue text; the repo is public.
- **Phase**: title `<Name> <n>/<N>: <scope>`, label `enhancement`, body starts with `Part of #<epic>`, then Scope, Tests, Acceptance. Name the branch `<slug>/<n>-<name>` and its base (phase 1 targets `main`, phase _n_ targets the phase _n-1_ branch).
- Create the epic first, then the phases, then edit the epic body to fill in the phase numbers.

Native sub-issue link (the phase appears under the epic with progress). `<db-id>` is the numeric database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), not the `#number`:

```
gh api --method POST repos/<owner>/<repo>/issues/<epic>/sub_issues -F sub_issue_id=<phase-db-id>
```

Native blocked-by link between phases (one call per edge; a linear chain for stacked PRs, phase _n_ blocked by phase _n-1_). `<blocker-db-id>` is the database id of the blocking issue:

```
gh api --method POST repos/<owner>/<repo>/issues/<phase>/dependencies/blocked_by -F issue_id=<blocker-db-id>
```

Verify with `gh api repos/<owner>/<repo>/issues/<epic>/sub_issues --jq '.[].number'` and `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary`. `sub_issues_summary.total` on the epic can lag a few seconds after linking.

Tip for long issue bodies: write them to a file and use `gh issue create --body-file <path>`. A big inline heredoc with backticks and quotes breaks easily in bash.

### Executing an epic

When asked to implement an epic, the main session acts as an orchestrator and delegates each phase to its own subagent.

- **One subagent per phase, fresh context.** Start a new subagent for every phase issue. Do not reuse or continue the agent of an earlier phase, and do not implement phases in the orchestrator's own context. A fresh context keeps each phase focused and stops assumptions from leaking between phases.
- **Strictly in sequence.** Phases are stacked PRs, each based on the previous branch, so never run two phases in parallel. Start phase _n_ only after phase _n-1_ has its branch pushed and its PR open. Follow the blocked-by order.
- **Brief each subagent completely.** It starts with no memory, so the prompt names the epic and phase issue numbers (it reads both with `gh issue view <n>`), the branch to create, the base branch, the PR it must open (targeting the previous phase's branch, or `main` for phase 1), and the repo rules: read `AGENTS.md` first, run `npm run lint -- --fix`, `npx tsc --noEmit` and `npm test` before finishing, and commit with the attribution lines from the session instructions. Do not hand it a hypothesis to confirm; point it at the issue.
- **A phase is done** when its acceptance criteria are met, the checks above pass, the branch is pushed and the PR is open with a body that references the phase issue (`Part of #<epic>`, no `Closes` on the epic). The subagent reports what it changed, what it verified and anything it deviated on. The orchestrator checks the report against the issue (and the PR's CI status) before starting the next phase.
- **Do not stop between phases unless something goes wrong.** Moving on to the next phase needs no confirmation from the user. Stop and report when any of these happens: a check or CI run fails and the subagent cannot fix it in scope; the issue is ambiguous or a decision is needed that the epic does not already settle; the phase needs a change outside its scope or contradicts an agreed decision; a migration or destructive step looks unsafe; a rebase or merge conflict with the base branch needs judgement; a phase's precondition (for example "wait one release before tightening") is not met. In that case say which phase, what happened and what is needed, and leave the remaining phases untouched.
- **Never merge, deploy or run migrations against production.** Opening PRs is part of the workflow. Merging, deploying and publishing are the owner's decisions unless they say otherwise for this epic.
- **Keep the tracker current.** After each phase, comment on the phase issue with the PR link and tick its box in the epic task list (edit the epic body). Close phase issues only when their PR merges.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
