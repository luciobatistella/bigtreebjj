"use strict";

// Hostinger's managed Node.js runtime looks for a concrete server entry file.
// Keep the production orchestration in its ES module and expose this conventional
// CommonJS entry at the repository root for reliable platform detection.
import("./scripts/start-hostinger.mjs").catch((error) => {
  console.error("[startup] Failed to initialize the application:", error);
  process.exitCode = 1;
});
