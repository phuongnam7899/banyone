# banyone

Starter monorepo with Expo mobile, NestJS backend, and shared TypeScript contracts.

## Prerequisites

- Node.js 22+
- npm 10+

## First Run

```bash
npm install
```

## Run Apps Locally

```bash
# Mobile app
npm run start --workspace mobile

# Backend API
npm run start:dev --workspace backend
```

## Quality Commands

```bash
# Workspace-wide quality gates
npm run lint
npm run typecheck
npm run test

# Per workspace
npm run lint --workspace mobile
npm run typecheck --workspace mobile
npm run test --workspace mobile

npm run lint --workspace backend
npm run typecheck --workspace backend
npm run test --workspace backend

npm run lint --workspace @banyone/contracts
npm run typecheck --workspace @banyone/contracts
npm run test --workspace @banyone/contracts
```

## Scaffold Commands Used

```bash
npx create-expo-app@latest apps/mobile --template default@sdk-55 --yes
npx @nestjs/cli@latest new apps/backend --package-manager npm --skip-git
```
