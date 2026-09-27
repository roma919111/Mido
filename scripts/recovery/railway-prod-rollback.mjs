#!/usr/bin/env node
/** Rollback Mido production to last known-good Docker deploy (vyronix r393 UI). Token: RAILWAY_PROJECT_TOKEN. */
const TOKEN =
  process.env.RAILWAY_PROJECT_TOKEN?.trim() ||
  process.env.RAILWAY_TOKEN?.trim() ||
  process.env.TOKEN?.trim();
if (!TOKEN) {
  console.error("Set RAILWAY_PROJECT_TOKEN");
  process.exit(1);
}

const PROJECT_ID = "8d4709b1-0945-4ba4-9d95-4bfae912e404";
const ENV_ID = "c6074ceb-a018-4f33-8804-2acdbc6b1175";
const SERVICE_ID = "2cbb1f32-9679-44b0-9c30-270079f1137f";
/** Known-good Docker rollback (full H3 rental UI, pre–git-main nav). */
const PREFERRED_ROLLBACK = "98499965-fcb4-43a0-a1c6-42a77caa8a8d";

async function gql(query, variables = {}) {
  const res = await fetch("https://backboard.railway.com/graphql/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Project-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Non-JSON", res.status, text.slice(0, 300));
    process.exit(1);
  }
  if (json.errors?.length) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

const listQuery = `
query($input: DeploymentListInput!, $first: Int!) {
  deployments(input: $input, first: $first) {
    edges {
      node {
        id
        status
        createdAt
        meta
      }
    }
  }
}`;

const rollbackMutation = `
mutation($id: String!) {
  deploymentRollback(id: $id)
}`;

async function main() {
  const override = process.env.RAILWAY_ROLLBACK_DEPLOYMENT_ID?.trim();
  if (override) {
    console.log("Rolling back to override:", override);
    const out = await gql(rollbackMutation, { id: override });
    console.log("deploymentRollback:", out.deploymentRollback);
    return;
  }

  const data = await gql(listQuery, {
    input: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID },
    first: 100,
  });
  const nodes = (data.deployments?.edges || []).map((e) => e.node);
  console.log("Recent deployments (newest first):");
  for (const n of nodes.slice(0, 12)) {
    const commit = n.meta?.commitMessage || n.meta?.image || "";
    console.log(`  ${n.status}\t${n.id}\t${n.createdAt}\t${String(commit).slice(0, 60)}`);
  }

  const preferred = nodes.find((n) => n.id === PREFERRED_ROLLBACK);
  const rollbackId = preferred?.id || PREFERRED_ROLLBACK;
  console.log("\nRolling back to known-good Docker:", rollbackId);
  const out = await gql(rollbackMutation, { id: rollbackId });
  console.log("deploymentRollback:", out.deploymentRollback);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
