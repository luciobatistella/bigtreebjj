import { spawn } from "node:child_process";
import { chmod, readdir, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(projectRoot, "apps", "api");
const webRoot = path.join(projectRoot, "apps", "web");
const apiEntry = path.join(apiRoot, "dist", "index.js");
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
const passenger =
  typeof PhusionPassenger !== "undefined" ? PhusionPassenger : undefined;
const runsUnderPassenger = Boolean(passenger?.configure);

// Passenger normally captures the first HTTP server that calls listen(). This
// application has an internal Express server and a public Next.js server, so
// select the public server explicitly and let Express keep its local TCP port.
if (runsUnderPassenger) {
  passenger.configure({ autoInstall: false });
}

function validPort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? String(port) : fallback;
}

// Hostinger's managed Node.js reverse proxy forwards public traffic to port 3000.
// WEB_PORT remains available for isolated local validation without letting a
// platform-provided generic PORT value move the production listener.
const webPort = validPort(process.env.WEB_PORT, "3000");
const apiPort = validPort(process.env.API_PORT, webPort === "3001" ? "3101" : "3001");
const internalApiUrl = process.env.API_INTERNAL_URL || `http://127.0.0.1:${apiPort}`;
const runtimeEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  API_PORT: apiPort,
  API_INTERNAL_URL: internalApiUrl
};

const hasDatabase = Boolean(process.env.DATABASE_URL);

async function ensurePrismaEnginesExecutable() {
  if (process.platform === "win32") return;

  const realPrismaEntry = await realpath(prismaEntry);
  const requireFromPrisma = createRequire(realPrismaEntry);
  const enginesPackage = requireFromPrisma.resolve("@prisma/engines/package.json");
  const enginesRoot = path.dirname(enginesPackage);
  const engineNames = (await readdir(enginesRoot)).filter(
    (name) => name.startsWith("schema-engine-") || name.startsWith("migration-engine-")
  );

  await Promise.all(
    engineNames.map(async (name) => {
      const enginePath = path.join(enginesRoot, name);
      const engineStat = await stat(enginePath);
      await chmod(enginePath, engineStat.mode | 0o100);
    })
  );

  if (engineNames.length > 0) {
    console.log(`[startup] Verified execute permission for ${engineNames.length} Prisma engine.`);
  }
}

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
  await ensurePrismaEnginesExecutable();
  console.log("[startup] Applying pending database migrations...");
  const migrationEnvironment = {
    ...runtimeEnvironment,
    DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL
  };
  const migration = run(
    process.execPath,
    [prismaEntry, "migrate", "deploy", "--schema", prismaSchema],
    { cwd: projectRoot, env: migrationEnvironment }
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

// Keep the public HTTP listener in this entry process. Hostinger monitors and
// exposes the process it launches; a detached `next start` child can remain
// invisible to the managed reverse proxy even while the parent appears healthy.
Object.assign(process.env, runtimeEnvironment);
await import(pathToFileURL(apiEntry).href);

const requireFromWeb = createRequire(path.join(webRoot, "package.json"));
const next = requireFromWeb("next");
const nextApp = next({
  dev: false,
  dir: webRoot,
  hostname: "0.0.0.0",
  port: Number(webPort)
});
await nextApp.prepare();

const handleNextRequest = nextApp.getRequestHandler();
const webServer = createServer((request, response) => {
  handleNextRequest(request, response).catch((error) => {
    console.error("[web] Unhandled request error:", error);
    if (!response.headersSent) response.statusCode = 500;
    if (!response.writableEnded) response.end("Internal Server Error");
  });
});

await new Promise((resolve, reject) => {
  webServer.once("error", reject);
  if (runsUnderPassenger) {
    webServer.listen("passenger", resolve);
    return;
  }
  webServer.listen(Number(webPort), "0.0.0.0", resolve);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[startup] Received ${signal}; stopping the web server.`);
  const forcedExit = setTimeout(() => process.exit(0), 5_000);
  forcedExit.unref();
  webServer.close();
  try {
    await nextApp.close();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(
  runsUnderPassenger
    ? `[startup] Web listening on Passenger; API available internally on port ${apiPort}.`
    : `[startup] Web listening in the entry process on port ${webPort}; API available internally on port ${apiPort}.`
);
