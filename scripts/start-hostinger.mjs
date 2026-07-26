import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(projectRoot, "apps", "api");
const webRoot = path.join(projectRoot, "apps", "web");
const apiEntry = path.join(apiRoot, "dist", "index.js");
const nextEntry = path.join(webRoot, "node_modules", "next", "dist", "bin", "next");
const prismaEntry = path.join(
  projectRoot,
  "packages",
  "database",
  "node_modules",
  "prisma",
  "build",
  "index.js"
);
const prismaSchema = path.join(projectRoot, "packages", "database", "prisma", "schema.prisma");

function validPort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? String(port) : fallback;
}

const webPort = validPort(process.env.PORT, "3000");
const apiPort = validPort(process.env.API_PORT, webPort === "3001" ? "3101" : "3001");
const internalApiUrl = process.env.API_INTERNAL_URL || `http://127.0.0.1:${apiPort}`;
const runtimeEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  API_PORT: apiPort,
  API_INTERNAL_URL: internalApiUrl
};

const hasDatabase = Boolean(process.env.DATABASE_URL);

function run(command, args, options) {
  return spawn(command, args, {
    stdio: "inherit",
    windowsHide: true,
    ...options
  });
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with ${signal || `code ${code ?? 1}`}.`));
    });
  });
}

if (hasDatabase) {
  console.log("[startup] Applying pending database migrations...");
  const migration = run(
    process.execPath,
    [prismaEntry, "migrate", "deploy", "--schema", prismaSchema],
    { cwd: projectRoot, env: runtimeEnvironment }
  );

  try {
    await waitForExit(migration, "Database migration");
  } catch (error) {
    console.error(`[startup] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
} else {
  console.warn(
    "[startup] DATABASE_URL is not configured. Starting the website without lineage data."
  );
}

const api = run(process.execPath, [apiEntry], {
  cwd: apiRoot,
  env: runtimeEnvironment
});
const web = run(process.execPath, [nextEntry, "start", "-p", webPort], {
  cwd: webRoot,
  env: runtimeEnvironment
});
const services = [
  { child: api, label: "API" },
  { child: web, label: "Web" }
];
let shuttingDown = false;
let exitCode = 0;

function shutdown(signal = "SIGTERM", code = exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
  process.exitCode = exitCode;
  for (const { child } of services) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
  setTimeout(() => {
    for (const { child } of services) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 5_000).unref();
}

for (const { child, label } of services) {
  child.once("error", (error) => {
    console.error(`[startup] Could not start ${label}: ${error.message}`);
    shutdown("SIGTERM", 1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[startup] ${label} stopped (${signal || `code ${code ?? 1}`}).`);
    shutdown("SIGTERM", code || 1);
  });
}

process.on("SIGINT", () => shutdown("SIGINT", 0));
process.on("SIGTERM", () => shutdown("SIGTERM", 0));

console.log(`[startup] Web listening on port ${webPort}; API available internally on port ${apiPort}.`);
