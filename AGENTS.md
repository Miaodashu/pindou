# AGENTS.md

## Project overview

- Project: `pindou`
- Purpose: A commercial-grade web application for drawing bead patterns and converting imported images into editable patterns with explicit brand color codes and bead counts.
- Runtime: Node.js 22.22.2 (see `.nvmrc`), npm 10.9.7, Vue 3, TypeScript, and Vite.
- Main source directories: `src/app/` for application composition, `src/views/` for route-level screens, and `src/` for shared application code and styles.
- Test directories: colocated `src/**/*.spec.ts` unit tests and `e2e/` Playwright tests.
- Important documentation: `docs/changes/` for change lifecycle documents and `docs/agents/` for engineering-skill configuration once initialized.

## Development commands

- Select the repository Node version: `nvm use`
- Install dependencies: `npm ci`
- Start the development environment: `npm run dev`
- Unit tests: `npm test`
- Unit tests in watch mode: `npm run test:watch`
- Type checking: `npm run type-check`
- Lint: `npm run lint`
- Check formatting: `npm run format:check`
- Apply formatting: `npm run format`
- Build: `npm run build`
- Combined type, lint, unit, and build checks: `npm run check`
- Install E2E browsers after a fresh Playwright install: `npx playwright install chromium webkit`
- End-to-end tests: `npm run e2e`

Only document commands verified from this repository. Leave unknown commands as `TODO` rather than guessing.

## Frontend architecture

- Render dense bead grids with a native Canvas 2D adapter using batched or tiled drawing. Do not create one DOM, Konva, or Pixi display object per bead.
- Keep grid state, commands, history, palettes, and image-conversion logic independent from the Canvas renderer so they remain unit-testable.
- Load OpenCV.js/WASM only inside the image-conversion workflow and run expensive processing in a Web Worker. Do not add it to the initial application bundle.
- Treat palette codes as authoritative data. Display colors are previews and must not replace brand, series, code, symbol, and measured color metadata.
- Persist versioned, schema-validated project data; migrations must preserve previously saved patterns.

## Agent skills

### Issue tracker

Issues and specifications are tracked in GitHub Issues for `Miaodashu/pindou`. See `docs/agents/issue-tracker.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.

## AI development workflow

Engineering skills must follow the issue tracker and domain-document conventions in `docs/agents/`.

For a new feature, complex bug, refactor, or change spanning multiple modules:

1. Use `$grill-with-docs` to clarify `docs/changes/<change-id>/brief.md`.
2. Use `$think` to explore the approach, tradeoffs, risks, and verification strategy.
3. Use `$to-spec` to publish the specification to the configured issue tracker.
4. After human approval of the specification, use `$to-tickets` to publish executable tickets to that tracker.
5. Use `$implement` for one independently verifiable ticket at a time.
6. Use `$code-review` after implementation.
7. Use `$diagnosing-bugs` when a test fails or behavior differs from the specification.
8. Use `$handoff` when work pauses or is ready for review.

Small, low-risk edits may skip specification and ticket generation when the request is already unambiguous. They still require proportionate verification.

## Safety boundaries

- Do not access production systems or production databases unless explicitly authorized.
- Do not commit credentials, tokens, secrets, or personal data.
- Ask before destructive database operations, public API compatibility breaks, dependency major-version upgrades, or deployment changes.
- Preserve unrelated user changes in the working tree.
- Do not mark work complete until relevant verification succeeds or remaining failures are clearly reported.

## Definition of done

- The approved acceptance criteria are satisfied.
- Relevant tests and repository checks pass.
- The final diff has been reviewed.
- Known limitations and unresolved risks are documented.
- A handoff summary exists for substantive work.
