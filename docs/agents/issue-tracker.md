# Issue tracker: GitHub

Issues and specifications for this repository live as GitHub issues in `Miaodashu/pindou`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). With older `gh`, use `gh api --method POST repos/Miaodashu/pindou/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`. Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- **Close an issue**: `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` does this automatically when run inside this repository.

## Pull requests as a triage surface

**PRs as a request surface: no.**

If this is changed to `yes` later, pull requests run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>`.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment, label, or close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, or `gh pr close`.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42` and fall back to `gh issue view 42`.

## Skill operations

- When a skill says **publish to the issue tracker**, create a GitHub issue.
- When a skill says **fetch the relevant ticket**, read it using the command above.

## Wayfinding operations

- **Map**: a single issue labelled `wayfinder:map`, holding Notes, Decisions-so-far, and Fog. Create it with `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. If sub-issues are unavailable, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Use `wayfinder:<type>` labels such as `research`, `prototype`, `grilling`, or `task`.
- **Blocking**: use GitHub native issue dependencies. Add an edge with `gh api --method POST repos/Miaodashu/pindou/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where the database ID comes from `gh api repos/Miaodashu/pindou/issues/<n> --jq .id`. If dependencies are unavailable, put `Blocked by: #<n>` at the top of the child body.
- **Frontier query**: list the map's open children, omit assigned tickets and tickets with open blockers, and select the first remaining ticket in map order.
- **Claim**: `gh issue edit <n> --add-assignee @me`; this is the session's first write.
- **Resolve**: comment with the answer, close the ticket, and append a context pointer to the map's Decisions-so-far.
