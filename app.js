"use strict";

const { existsSync } = require("node:fs");
const { homedir } = require("node:os");
const { join, resolve } = require("node:path");

// Hostinger's managed Node.js runtime looks for a concrete server entry file.
// Keep the production orchestration in its ES module and expose this conventional
// CommonJS entry at the repository root for reliable platform detection.
if (!process.env.DATABASE_URL) {
  const accountHome = process.env.LSNODE_ROOT
    ? resolve(process.env.LSNODE_ROOT, "../../..")
    : homedir();
  const privateEnvironmentFile = join(
    accountHome,
    ".config",
    "bigtreebjj",
    "production.env"
  );
  if (existsSync(privateEnvironmentFile)) {
    process.loadEnvFile(privateEnvironmentFile);
    console.log("[startup] Loaded the private Hostinger runtime environment.");
  }
}

import("./scripts/start-hostinger.mjs").catch((error) => {
  console.error("[startup] Failed to initialize the application:", error);
  process.exitCode = 1;
});
