#!/usr/bin/env node
/**
 * Restore production Mido to the last good Docker deployment (r393 / H3 + HF Space).
 * Uses Railway Public API (api.railway.app) — works with project tokens.
 *
 *   RAILWAY_PROJECT_TOKEN=… node scripts/recovery/railway-prod-rollback.mjs
 */
const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.RAILWAY_TOKEN;
/** Good Docker deploy after rollback (MiniMax H3 + /api/h3-lab). */
const REDEPLOY_DEPLOYMENT_ID =
  process.env.RAILWAY_REDEPLOY_DEPLOYMENT_ID || "b3117a93-d348-4a1e-8262-6c410876ecda";

if (!TOKEN) {
  console.error("Set RAILWAY_PROJECT_TOKEN");
  process.exit(1);
}

const mutation = `
  mutation Redeploy($id: String!) {
    deploymentRedeploy(id: $id) {
      id
      status
    }
  }
`;

const res = await fetch("https://api.railway.app/graphql/v2", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
    "Project-Access-Token": TOKEN,
  },
  body: JSON.stringify({
    query: mutation,
    variables: { id: REDEPLOY_DEPLOYMENT_ID },
  }),
});

const json = await res.json();
if (json.errors?.length) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}

console.log("deploymentRedeploy:", json.data?.deploymentRedeploy);
console.log("Verify: curl -sS https://vyronix.app/api/h3-lab/config  # expect 401 not 404");
