// scripts/refresh-strava-token.js
import fetch from "node-fetch";

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_USER_ID,
} = process.env;

if (
  !STRAVA_CLIENT_ID ||
  !STRAVA_CLIENT_SECRET ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !SUPABASE_USER_ID
) {
  console.error("Missing one or more required env vars:", {
    STRAVA_CLIENT_ID: !!STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: !!STRAVA_CLIENT_SECRET,
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_USER_ID: !!SUPABASE_USER_ID,
  });
  process.exit(1);
}

async function main() {
  // 1) Read current tokens from Supabase
  const tokenQueryUrl =
    `${SUPABASE_URL}/rest/v1/strava_tokens` +
    `?select=user_id,access_token,refresh_token,expires_at` +
    `&user_id=eq.${encodeURIComponent(SUPABASE_USER_ID)}`;

  const tokenRes = await fetch(tokenQueryUrl, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });

  if (!tokenRes.ok) {
    console.error(
      "Failed to fetch current Strava tokens from Supabase:",
      await tokenRes.text()
    );
    process.exit(1);
  }

  const rows = await tokenRes.json();
  if (!rows.length) {
    console.error("No strava_tokens row found for user_id:", SUPABASE_USER_ID);
    process.exit(1);
  }

  const current = rows[0];
  if (!current.refresh_token) {
    console.error("Row exists but has no refresh_token:", current);
    process.exit(1);
  }

  console.log("Current token row found; refreshing with Strava...");
  console.log("Using client_id:", STRAVA_CLIENT_ID);
  console.log("Refresh token length:", current.refresh_token?.length || 0);
  console.log("Refresh token starts with:", current.refresh_token?.substring(0, 10) || "N/A");

  // 2) Refresh with Strava
  const requestBody = {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
  };

  const stravaRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!stravaRes.ok) {
    const errorText = await stravaRes.text();
    console.error("Failed to refresh token with Strava:");
    console.error("Status:", stravaRes.status, stravaRes.statusText);
    console.error("Response:", errorText);
    
    // Try to parse as JSON for better error display
    try {
      const errorJson = JSON.parse(errorText);
      console.error("Parsed error:", JSON.stringify(errorJson, null, 2));
    } catch {
      // Not JSON, already logged as text
    }
    
    process.exit(1);
  }

  const data = await stravaRes.json();
  const { access_token, refresh_token, expires_at } = data;

  if (!access_token || !refresh_token) {
    console.error("Strava response missing tokens:", data);
    process.exit(1);
  }

  const expiresAtIso = expires_at
    ? new Date(expires_at * 1000).toISOString()
    : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  console.log("New tokens received from Strava; updating Supabase...");

  // 3) Update Supabase row
  const updateUrl =
    `${SUPABASE_URL}/rest/v1/strava_tokens` +
    `?user_id=eq.${encodeURIComponent(SUPABASE_USER_ID)}`;

  const updateRes = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!updateRes.ok) {
    console.error(
      "Failed to update strava_tokens in Supabase:",
      await updateRes.text()
    );
    process.exit(1);
  }

  const updated = await updateRes.json();
  console.log("Strava tokens refreshed and stored in Supabase:", updated);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

