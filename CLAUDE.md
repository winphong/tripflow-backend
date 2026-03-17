# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev       # Start with hot reload (--watch)
bun run start     # Start production server
bun run migrate   # Run DB migrations (creates collections + indexes)
```

The server runs on port **3005**. Requires environment variables: `MONGODB_URI` and `JWT_SECRET`.

## Architecture

This is a Bun HTTP server (no framework) for the TripFlow trip planning app.

**Request flow:** `index.ts` → `router.ts` → `handlers/*`

- **`router.ts`**: Manual URL pattern matching with regex. All routes are `withCors()`-wrapped. Protected routes call `verifyAuth()` first — it returns either `{ userId }` or a `Response` (401), and the router returns early on auth failure.
- **`middleware/auth.ts`**: JWT verification via `jose`. Extracts `userId` from `sub` claim.
- **`db.ts`**: Single MongoDB client, database name `tripflow`, accessed via `getDB()`.
- **`handlers/`**: Each handler receives already-parsed `userId` and request body. No framework — handlers return `Response` objects directly.
- **`types.ts`**: Shared TypeScript interfaces for `Trip`, `DayPlan`, `TripItem`, `User`.

## Data Model

Three MongoDB collections:

- **`users`**: `{ email, passwordHash, createdAt }`, unique index on `email`
- **`trips`**: `{ name, userId (ObjectId), createdAt }`, index on `userId`
- **`days`**: `{ _id: "day-{tripId}-{YYYYMMDD}", date, tripId (string), items[] }`, compound unique index on `{tripId, date}`

`TripItem` is embedded in `days.items` array. Items use `arrayFilters` for MongoDB positional updates. Authorization for days/items is checked via `checkTripOwnership()` (verifies `trips.userId` matches the authenticated user).

## API Routes

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | No |
| POST | `/api/auth/register` | No |
| POST | `/api/auth/login` | No |
| GET/POST | `/api/trips` | Yes |
| DELETE | `/api/trips/:tripId` | Yes |
| GET/POST | `/api/trips/:tripId/days` | Yes |
| DELETE | `/api/trips/:tripId/days/:dayId` | Yes |
| POST | `/api/trips/:tripId/days/:dayId/items` | Yes |
| PUT/DELETE | `/api/trips/:tripId/days/:dayId/items/:itemId` | Yes |

CORS is hardcoded to allow `http://localhost:3001`.
