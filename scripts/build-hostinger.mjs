import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(projectRoot, "apps", "api");
const webRoot = path.join(projectRoot, "apps", "web");

const tasks = [
  {
    label: "Public media policy",
    cwd: projectRoot,
    entry: path.join(projectRoot, "scripts", "audit-public-media.mjs"),
    args: []
  },
  {
    label: "Prisma Client",
    cwd: projectRoot,
    entry: path.join(
      projectRoot,
      "packages",
      "database",
      "node_modules",
      "prisma",
      "build",
      "index.js"
    ),
    args: [
      "generate",
      "--schema",
      path.join(projectRoot, "packages", "database", "prisma", "schema.prisma")
    ]
  },
  {
    label: "API",
    cwd: apiRoot,
    entry: path.join(apiRoot, "node_modules", "typescript", "bin", "tsc"),
    args: ["-p", path.join(apiRoot, "tsconfig.json")]
  },
  {
    label: "Web",
    cwd: webRoot,
    entry: path.join(webRoot, "node_modules", "next", "dist", "bin", "next"),
    args: ["build"]
  }
];

function runTask(task) {
  console.log(`[build] Building ${task.label}...`);
  const child = spawn(process.execPath, [task.entry, ...task.args], {
    cwd: task.cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[build] ${task.label} completed.`);
        resolve();
        return;
      }
      reject(
        new Error(
          `${task.label} build failed with ${signal || `code ${code ?? 1}`}.`
        )
      );
    });
  });
}

try {
  for (const task of tasks) {
    await runTask(task);
  }
  console.log("[build] Production build completed.");
} catch (error) {
  console.error(`[build] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
