# Project: NosyFE Frontend

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS

## UI Philosophy

Prefer:

- clean
- modern
- lightweight
- consistent UI

Avoid:

- unnecessary animations
- excessive colors
- overly complex layouts

## Existing Style

Always match the existing design language.

Prefer extending existing components over creating new ones.

Keep spacing, typography and colors consistent.

## API

All API calls belong in:

src/api

If backend endpoints change:

- update frontend immediately.

## State

Prefer existing state management.

Do not introduce a new state library unless requested.

## Components

Keep components focused.

Extract reusable UI only when reused multiple times.

Do not over-componentize.

## Performance

Avoid unnecessary re-renders.

Memoize only when beneficial.

Lazy-load only when it provides real value.

## Styling

Prefer Tailwind utilities.

Reuse existing utility classes.

Avoid inline styles unless necessary.

## Environment

Check .env for API URLs.

Do not modify deployment configuration.

Do not touch:

- Vercel config
- deployment settings

unless explicitly requested.

## Validation

Before finishing:

- build only the frontend project
- lint only modified files