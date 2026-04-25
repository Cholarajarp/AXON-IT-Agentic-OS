# Contributing to AXON IT Agentic OS

AXON IT Agentic OS is open source under the Apache License 2.0. Contributions are welcome when they improve reliability, security, usability, documentation, tests, or production readiness.

## Contribution Terms

By submitting a pull request, issue, patch, or other contribution, you agree that:

- Your contribution is submitted under the Apache License 2.0.
- You have the legal right to submit the contribution.
- Your contribution does not include secrets, private customer data, proprietary code you cannot license, or material copied from another project without permission.
- Your contribution is voluntary and unpaid unless there is a separate written agreement with the project owner.
- A contribution does not create employment, partnership, equity, royalty, revenue-share, or ownership rights.

## Development Setup

Install dependencies:

```bash
npm install
cd backend
npm install
cd ..
```

Create local environment files:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

Start local infrastructure:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
```

Start the app:

```bash
npm run dev:all
```

## Project Rules

- Keep the active structure: `src/`, `backend/`, `electron/`, `scripts/`, `tests/`.
- Do not recreate duplicate root projects.
- Do not commit `docs/`; it is ignored as local/internal planning material.
- Do not commit `.env`, `.axon/`, `backend/.axon/`, `dist/`, `backend/dist/`, `node_modules/`, or test output.
- Keep frontend API calls inside typed query hooks where possible.
- Keep backend route handlers thin and put business behavior in service modules.
- Keep security, audit, production-readiness, and customer-facing claims evidence-backed.

## Validation

Run the relevant checks before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run test:e2e
npm run build
cd backend
npm run build
cd ..
```

## Pull Request Checklist

- [ ] The change is focused and described clearly.
- [ ] No secrets or local artifacts are included.
- [ ] Tests were added or updated for changed behavior.
- [ ] Typecheck and lint pass.
- [ ] Browser route audit passes for UI changes.
- [ ] Backend build passes for API/runtime changes.
- [ ] README or env examples were updated if setup or behavior changed.

## Security

Do not open public issues for exploitable vulnerabilities. Send security reports privately to:

```text
Cholaraja R P <ccholarajarp@gmail.com>
```
