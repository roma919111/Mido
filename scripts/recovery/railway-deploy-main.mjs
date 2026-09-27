#!/usr/bin/env node
/**
 * Trigger a Railway deploy for Mido (vyronix.app) from the linked GitHub repo.
 * Token: RAILWAY_PROJECT_TOKEN or RAILWAY_TOKEN (Project token, agile-serenity).
 */
const TOKEN =
  process.env.RAILWAY_PROJECT_TOKEN?.trim() ||
  process.env.RAILWAY_TOKEN?.trim() ||
  process.env.TOKEN?.trim();

if (!TOKEN) {
  console.error(
    "Missing token. Set RAILWAY_PROJECT_TOKEN (Railway → Project → Settings → Tokens).",
  );
  process.exit(1);
}

const PROJECT_ID = "8d4709b1-0945-4ba4-9d95-4bfae912e404";
const ENV_ID = "c6074ceb-a018-4f33-8804-2acdbc6b1175";
const SERVICE_ID = "2cbb1f32-9679-44b0-9c30-270079f1137f";

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
    console.error("Non-JSON", res.status, text.slice(0, 400));
    process.exit(1);
  }
  if (json.errors?.length) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

const deployMutation = `
mutation($serviceId: String!, $environmentId: String!) {
  serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
}`;

async function main() {
  console.log("Triggering Railway deploy for Mido (production)…");
  const data = await gql(deployMutation, {
    serviceId: SERVICE_ID,
    environmentId: ENV_ID,
  });
  console.log("serviceInstanceDeploy:", data.serviceInstanceDeploy);
  console.log(
    "Watch: Railway → agile-serenity → Mido → Deployments. Then check https://vyronix.app/api/health",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
