#!/usr/bin/env node
/** List Mido production deployments and rollback to last good Docker deploy. Token via env RAILWAY_PROJECT_TOKEN. */
const TOKEN =
  process.env.RAILWAY_PROJECT_TOKEN ||
  process.env.RAILWAY_TOKEN ||
  process.env.TOKEN;
if (!TOKEN) {
  console.error("Set RAILWAY_PROJECT_TOKEN");
  process.exit(1);
}

const PROJECT_ID = "8d4709b1-0945-4ba4-9d95-4bfae912e404";
const ENV_ID = "c6074ceb-a018-4f33-8804-2acdbc6b1175";
const SERVICE_ID = "2cbb1f32-9679-44b0-9c30-270079f1137f";
/** Bad git deploy from main (r398 shell + /tools nav). */
const BAD_DEPLOY_PREFIX = "0a95c109";
/** Known-good rollback target from prod history (full H3 Docker). */
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
query($input: DeploymentListInput!) {
  deployments(input: $input, first: 25) {
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
  const data = await gql(listQuery, {
    input: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID },
  });
  const nodes = (data.deployments?.edges || []).map((e) => e.node);
  console.log("Recent deployments:");
  for (const n of nodes) {
    const commit = n.meta?.commitMessage || n.meta?.image || "";
    console.log(`  ${n.status}\t${n.id}\t${n.createdAt}\t${String(commit).slice(0, 60)}`);
  }

  let rollbackId = PREFERRED_ROLLBACK;
  const preferred = nodes.find((n) => n.id === PREFERRED_ROLLBACK);
  const good = nodes.find(
    (n) => n.status === "SUCCESS" && !n.id.startsWith(BAD_DEPLOY_PREFIX),
  );
  if (preferred) rollbackId = preferred.id;
  else if (good) rollbackId = good.id;
  else {
    console.error(
      "No safe SUCCESS deploy in list; pass RAILWAY_ROLLBACK_DEPLOYMENT_ID or rollback manually in Railway UI.",
    );
    process.exit(1);
  }
  console.log("\nRolling back to:", rollbackId);
  const out = await gql(rollbackMutation, { id: rollbackId });
  console.log("deploymentRollback:", out.deploymentRollback);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
