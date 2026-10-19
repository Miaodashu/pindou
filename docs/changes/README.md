# Change workspaces

Store local intake notes and optional supporting artifacts in one directory per feature, bug, refactor, migration, or other substantive change:

```text
docs/changes/<change-id>/
├── brief.md
├── spec.md
├── tickets.md
├── review.md
└── handoff.md
```

Create `brief.md` first. Add later documents only when repository policy keeps those artifacts locally. Matt Pocock's `$to-spec` and `$to-tickets` publish to the issue tracker configured in `docs/agents/issue-tracker.md`; avoid duplicating the canonical copy.

Suggested flow:

```text
brief → grill-with-docs → think → configured issue tracker → to-tickets
      → implement → code-review → verification → handoff
```

Reusable starting points live in `_templates/`. Project history may be archived or removed according to the repository's own policy.
