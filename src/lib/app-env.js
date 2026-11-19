// The Stadium (3D page) is only shown when the app runs as the dev environment.
// NEXT_PUBLIC_ values are inlined at build time, so the nav link and the route agree.
// Set NEXT_PUBLIC_APP_ENV=dev in .env.local to see it locally. Production leaves it unset.
export const STADIUM_ENABLED = process.env.NEXT_PUBLIC_APP_ENV === "dev";
