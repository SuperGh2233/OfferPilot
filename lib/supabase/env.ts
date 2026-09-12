export function isLocalDemoMode() {
  return (
    process.env.NODE_ENV === "development" &&
    (process.env.LOCAL_DEMO_MODE === "true" || isLocalDatabaseMode())
  );
}

export function isLocalDatabaseMode() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_DATABASE_MODE === "true"
  );
}

export function isBrowserDemoMode() {
  return isLocalDemoMode() && !isLocalDatabaseMode();
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in the project values.",
    );
  }

  return { url, publishableKey };
}
