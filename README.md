# banyone

Starter monorepo with Expo mobile, NestJS backend, and shared TypeScript contracts.

## Prerequisites

- Node.js 22+
- npm 10+

## First Run

```bash
npm install
```

## Troubleshooting (Expo)

If `expo start` crashes with **`Cannot find module 'expo-router/_ctx-shared'`** or **`expo-router/internal/routing`**, the Expo CLI is resolving `expo-router` from the **repo root** `node_modules`, while npm workspaces had installed it only under **`apps/mobile/node_modules`**. This repo declares **`expo-router`** as a **root** dependency in `package.json` so it is hoisted next to `@expo/cli`. After pulling changes, run **`npm install`** from the repo root. (Typed routes stay off in `app.json` unless you deliberately re-enable them.)

If Expo Go shows **“Project is incompatible… requires a newer version of Expo Go”** after scanning the QR code: this app uses **Expo SDK 55**. During Expo’s transition window, **Google Play / App Store “Expo Go” may still be SDK 54**, so “latest” there is not always SDK 55. Install the **SDK 55** build from **[expo.dev/go](https://expo.dev/go)** (pick **SDK 55** and **Android Install** or **iOS** as appropriate). On **iOS device**, you may need Expo’s **TestFlight** beta linked from the [SDK 55 changelog](https://expo.dev/changelog/sdk-55#transition-period-for-default-projects-and-expo-go) or a **development build**. **Web** (`npm run start --workspace mobile` then press `w`) needs no Expo Go.

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
