import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "TradeDocNavigator";
export default defineRailway(() => {
  const TradeDocNavigator = service("TradeDocNavigator", {
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    source: github("amancodeshere/TradeDocNavigator", {
      branch: "main",
      checkSuites: true,
    }),
    start: "node src/server.js",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: {
      restartPolicyMaxRetries: 5,
      limitOverride: { containers: { cpu: 4, memoryBytes: 4000000000 } },
    },
    networking: { privateNetworkEndpoint: "tradedocnavigator" },
  });

  // The CLI supports variable ownership; the SDK type currently omits that property.
  const definition = {
    variables: { managed: false },
    resources: [TradeDocNavigator],
  };
  return project("robust-tranquility", definition);
});
