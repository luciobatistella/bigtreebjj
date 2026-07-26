import { spawn } from "node:child_process";
import { chmod, readdir, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
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

Object.assign(process.env, runtimeEnvironment);

const requireFromWeb = createRequire(path.join(webRoot, "package.json"));
const next = requireFromWeb("next");
let nextApp;
let webServer;
let shuttingDown = false;

const apiEnvironment = { ...runtimeEnvironment };
// Hostinger injects its public-listener hook through NODE_OPTIONS. The API runs
// in an isolated worker thread without that preload, binds a real loopback TCP
// port, and is guaranteed to stop with the parent process.
delete apiEnvironment.NODE_OPTIONS;
delete apiEnvironment.BIGTREE_PASSENGER;

const api = new Worker(pathToFileURL(apiEntry), {
  env: apiEnvironment,
  execArgv: []
});

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[startup] Received ${signal}; stopping the application.`);
  const forcedExit = setTimeout(() => process.exit(exitCode), 5_000);
  forcedExit.unref();

  if (webServer) webServer.close();
  try {
    await Promise.allSettled([
      api.terminate(),
      nextApp ? nextApp.close() : Promise.resolve()
    ]);
  } finally {
    process.exit(exitCode);
  }
}

api.once("error", (error) => {
  console.error(`[startup] Could not start API: ${error.message}`);
  void shutdown("API_ERROR", 1);
});
api.once("exit", (code) => {
  if (shuttingDown) return;
  console.error(`[startup] API stopped (code ${code ?? 1}).`);
  void shutdown("API_EXIT", code || 1);
});

async function waitForApi() {
  const healthUrl = `${internalApiUrl}/health`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) return;
    } catch {
      // The child is still binding its loopback port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become ready at ${healthUrl}.`);
}

try {
  await waitForApi();
} catch (error) {
  console.error(`[startup] ${error instanceof Error ? error.message : error}`);
  await shutdown("API_TIMEOUT", 1);
}

try {
  nextApp = next({
    dev: false,
    dir: webRoot,
    hostname: "0.0.0.0",
    port: Number(webPort)
  });
  await nextApp.prepare();

  const handleNextRequest = nextApp.getRequestHandler();
  webServer = createServer((request, response) => {
    handleNextRequest(request, response).catch((error) => {
      console.error("[web] Unhandled request error:", error);
      if (!response.headersSent) response.statusCode = 500;
      if (!response.writableEnded) response.end("Internal Server Error");
    });
  });

  await new Promise((resolve, reject) => {
    webServer.once("error", reject);
    webServer.listen(Number(webPort), "0.0.0.0", resolve);
  });
} catch (error) {
  console.error(`[startup] Could not start Web: ${error instanceof Error ? error.message : error}`);
  await shutdown("WEB_ERROR", 1);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(
  `[startup] Web listening in the managed entry process; API available internally on port ${apiPort}.`
);
