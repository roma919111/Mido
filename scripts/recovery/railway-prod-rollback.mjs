#!/usr/bin/env node
/**
 * Roll production Mido service back to the known-good Docker deployment (r393 / H3 rental).
 * Requires RAILWAY_PROJECT_TOKEN with deploymentRollback permission.
 *
 *   RAILWAY_PROJECT_TOKEN=… node scripts/recovery/railway-prod-rollback.mjs
 */
const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.RAILWAY_TOKEN;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || "8d4709b1-0945-4ba4-9d95-4bfae912e404";
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID || "2cbb1f32-9679-44b0-9c30-270079f1137f";
const ENV_ID = process.env.RAILWAY_ENV_ID || "c6074ceb-a018-4f33-8804-2acdbc6b1175";
/** Good Docker deploy — ltx-full-video-r393 (MiniMax H3 + bottom nav intact). */
const ROLLBACK_DEPLOYMENT_ID =
  process.env.RAILWAY_ROLLBACK_DEPLOYMENT_ID || "98499965-fcb4-43a0-a1c6-42a77caa8a8d";

if (!TOKEN) {
  console.error("Set RAILWAY_PROJECT_TOKEN");
  process.exit(1);
}

const mutation = `
  mutation Rollback($deploymentId: String!) {
    deploymentRollback(deploymentId: $deploymentId)
  }
`;

const res = await fetch("https://backboard.railway.com/graphql/v2", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({
    query: mutation,
    variables: { deploymentId: ROLLBACK_DEPLOYMENT_ID },
  }),
});

const json = await res.json();
if (json.errors?.length) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}

console.log("deploymentRollback:", json.data?.deploymentRollback);
console.log("Verify: curl -sS https://vyronix.app/api/health | jq .build");
