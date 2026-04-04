# Contributing to Timeline Management

Thank you for contributing to Timeline Management. Please follow the guidelines below to keep our codebase consistent and our collaboration efficient.

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. **Protected — no direct commits.** |
| `develop` | Integration branch. All feature branches merge here via PR. |
| `feature/<ticket-id>-short-desc` | One branch per feature or task (e.g. `feature/TIM-12-shift-swap-ui`). |
| `fix/<ticket-id>-short-desc` | Hotfixes (e.g. `fix/TIM-15-schedule-overlap`). |

Always branch off from `develop` for new work:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/TIM-XX-short-description
```

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

### Types

| Type | When to use |
|------|------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Build process, dependency updates, or tooling changes |
| `docs` | Documentation-only changes |
| `test` | Adding or updating tests |

### Scope

Use the ticket ID as the scope:

```
feat(TIM-12): add shift swap UI
fix(TIM-15): resolve schedule overlap on weekly view
docs(TIM-11): add CONTRIBUTING.md with Git workflow
```

### Rules

- Use the imperative mood in the short description: "add" not "added" or "adds."
- Keep the subject line under 72 characters.
- Reference the ticket ID in the scope field on every commit.

---

## Pull Request Workflow

1. **Create a branch** off `develop` following the naming convention above.
2. **Do your work** in small, focused commits.
3. **Push your branch** and open a PR targeting `develop`:
   ```bash
   git push origin feature/TIM-XX-short-description
   ```
4. **PR title** must follow commit convention and reference the ticket:
   ```
   feat(TIM-12): add shift swap UI
   ```
5. **Wait for review** — at least one approval is required before merging.
6. **Delete the branch** after it is merged.

### Checklist before requesting review

- [ ] All commits follow the commit convention above.
- [ ] Code is tested locally.
- [ ] No debug logs or commented-out code left behind.
- [ ] PR description explains *what* changed and *why*.

---

## Questions?

Open a ticket in the project board or reach out in the team channel.
