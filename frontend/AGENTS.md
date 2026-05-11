# Smart Syllabus Frontend Guide

Frontend work in this repo lives in `product/frontend`. This app is the Smart Syllabus teacher/QA experience, not a generic Next.js starter.

## What To Read

- Project overview: [../../docs/PROJECT_COMPREHENSIVE_GUIDE.md](../../docs/PROJECT_COMPREHENSIVE_GUIDE.md)
- Frontend workflow notes: [../../docs/FRONTEND_README.md](../../docs/FRONTEND_README.md)
- Operator runbook: [../../docs/OPERATOR_QUICKSTART.md](../../docs/OPERATOR_QUICKSTART.md)
- Root agent guide: [../../AGENTS.md](../../AGENTS.md)

## Frontend Scope

- Auth screens and session-aware navigation
- Generator flow and wizard state
- Auditor flow and result rendering
- Shared UI components, role-based tabs, and language switching

## Main Files

- App routes: `app/`
- Shared components: `components/`
- Client auth/session helpers: `lib/`
- Route proxy and middleware helpers: `proxy.ts`

## Common Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Working Rules

- Preserve the Smart Syllabus visual language and role-specific behavior.
- Verify generator/auditor nav state after auth changes.
- Verify wizard state, autosave, and history behavior after form changes.
- If you touch translations or default language behavior, verify the user menu and all auth flows.
- If a UI change affects result layout, test both narrow and wide screens.

## Handoff Rule

If a frontend change affects backend payloads, update the backend contract and the docs in the same change set.
