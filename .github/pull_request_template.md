## What and why

<!-- What does this change, and what problem does it solve? Link the issue: "Closes #12". -->

## How it was tested

<!-- Tests added or changed, and what you checked by hand. -->

- [ ] `./mvnw verify` passes (if the backend changed)
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test` pass (if the frontend changed)
- [ ] `npm run e2e` passes, or this change doesn't touch the UI

## Checklist

- [ ] The title follows Conventional Commits (e.g. `feat(planner): …`, `fix(attendance): …`)
- [ ] New UI has loading, error and empty states, works with the keyboard and passes axe
- [ ] The mock API (`frontend/src/mocks/`) matches any API change
- [ ] Docs updated (`docs/api.md`, `docs/database.md`, README) where behaviour changed
- [ ] No secrets, personal data or real people's information in code, fixtures or screenshots

## Screenshots

<!-- For UI changes: before and after, light and dark. -->
