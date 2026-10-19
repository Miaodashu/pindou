# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `GLOSSARY.md` at the repository root.
- `docs/adr/`: read ADRs that affect the area about to be changed.

If either location does not exist, proceed silently. Do not flag its absence or suggest creating it upfront. The domain-modeling workflow creates these files lazily when terms or decisions are resolved.

## File structure

This is a single-context repository:

```text
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-decision.md
└── src/
```

## Use the glossary's vocabulary

When an issue title, refactor proposal, hypothesis, test name, or implementation names a domain concept, use the term defined in `GLOSSARY.md`. Do not drift to synonyms that the glossary explicitly avoids.

If a required concept is absent, reconsider whether the implementation is inventing language the product does not use. If the gap is real, record it for the domain-modeling workflow.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it, for example:

> Contradicts ADR-0007, but is worth reopening because…
