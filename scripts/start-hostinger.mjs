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
const managedRuntime = Boolean(process.env.LSNODE_ROOT);
const defaultApiPort = managedRuntime
  ? String(20_000 + (process.pid % 20_000))
  : webPort === "3001"
    ? "3101"
    : "3001";
const apiPort = validPort(process.env.API_PORT, defaultApiPort);
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

async function applyPendingMigrations() {
  if (!hasDatabase) {
    console.warn(
      "[startup] DATABASE_URL is not configured. Starting the website without lineage data."
    );
    return;
  }
  if (process.env.RUN_DATABASE_MIGRATIONS_ON_START !== "1") {
    console.log("[startup] Database migrations are managed separately from runtime startup.");
    return;
  }

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

  await waitForExit(migration, "Database migration");
}

Object.assign(process.env, runtimeEnvironment);

const apiEnvironment = { ...runtimeEnvironment };
// Hostinger injects its public-listener hook through NODE_OPTIONS. The API runs
// in an isolated worker thread without that preload, binds a real loopback TCP
// port, and is guaranteed to stop with the parent process.
delete apiEnvironment.NODE_OPTIONS;
delete apiEnvironment.BIGTREE_PASSENGER;

let api;
let nextApp;
let handleNextRequest;
let shuttingDown = false;
let resolveReadiness;
let rejectReadiness;
const readiness = new Promise((resolve, reject) => {
  resolveReadiness = resolve;
  rejectReadiness = reject;
});
void readiness.catch(() => undefined);

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[startup] Received ${signal}; stopping the application.`);
  const forcedExit = setTimeout(() => process.exit(exitCode), 5_000);
  forcedExit.unref();

  if (webServer) webServer.close();
  try {
    await Promise.allSettled([
      api ? api.terminate() : Promise.resolve(),
      nextApp ? nextApp.close() : Promise.resolve()
    ]);
  } finally {
    process.exit(exitCode);
  }
}

const webServer = createServer((request, response) => {
  void (async () => {
    try {
      if (!handleNextRequest) await readiness;
      await handleNextRequest(request, response);
    } catch (error) {
      console.error("[web] Unhandled request error:", error);
      if (!response.headersSent) {
        response.statusCode = 503;
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Retry-After", "2");
      }
      if (!response.writableEnded) response.end("Service Unavailable");
    }
  })();
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// lsnode requires the managed entry file to call listen() within three seconds.
// Establish the public socket before database, API, or Next.js initialization;
// early requests wait asynchronously on `readiness` instead of failing startup.
await new Promise((resolve, reject) => {
  webServer.once("error", reject);
  webServer.listen(Number(webPort), "0.0.0.0", resolve);
});
console.log("[startup] Public listener established; preparing application services.");

async function waitForApi() {
  const healthUrl = `${internalApiUrl}/health`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) return;
    } catch {
      // The worker is still binding its loopback port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become ready at ${healthUrl}.`);
}

try {
  api = new Worker(pathToFileURL(apiEntry), {
    env: apiEnvironment,
    execArgv: []
  });
  api.once("error", (error) => {
    console.error(`[startup] Could not start API: ${error.message}`);
    rejectReadiness(error);
    void shutdown("API_ERROR", 1);
  });
  api.once("exit", (code) => {
    if (shuttingDown) return;
    const error = new Error(`API stopped with code ${code ?? 1}.`);
    console.error(`[startup] ${error.message}`);
    rejectReadiness(error);
    void shutdown("API_EXIT", code || 1);
  });

  const requireFromWeb = createRequire(path.join(webRoot, "package.json"));
  const next = requireFromWeb("next");
  nextApp = next({
    dev: false,
    dir: webRoot,
    hostname: "0.0.0.0",
    port: Number(webPort)
  });
  await Promise.all([
    waitForApi(),
    nextApp.prepare(),
    applyPendingMigrations()
  ]);

  handleNextRequest = nextApp.getRequestHandler();
  resolveReadiness();
} catch (error) {
  const startupError = error instanceof Error ? error : new Error(String(error));
  console.error(`[startup] Could not prepare application: ${startupError.message}`);
  rejectReadiness(startupError);
  await shutdown("STARTUP_ERROR", 1);
}

console.log(
  `[startup] Application ready; API available internally on port ${apiPort}.`
);
