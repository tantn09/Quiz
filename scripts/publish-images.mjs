import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composePath = join(root, "release", "compose.yaml");
const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
const options = { namespace: "tantn09", tag: timestamp, service: "all", dryRun: false };

for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--dry-run") { options.dryRun = true; continue; }
  if (argument === "--namespace" || argument === "--tag" || argument === "--service") {
    const value = process.argv[++index];
    if (!value) throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2)] = value;
    continue;
  }
  throw new Error(`Unknown argument: ${argument}`);
}

if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(options.namespace)) {
  throw new Error("Docker Hub namespace must contain lowercase letters, digits, dots, underscores, or hyphens.");
}
if (!/^[\w][\w.-]{0,127}$/.test(options.tag)) {
  throw new Error("Invalid Docker image tag.");
}
if (options.tag === "latest") {
  throw new Error("Use a version tag other than latest; the script publishes latest automatically.");
}
if (!["all", "api", "web"].includes(options.service)) {
  throw new Error("--service must be all, api, or web.");
}

const compose = readFileSync(composePath, "utf8");
let updatedCompose = compose;
const services = options.service === "all" ? ["api", "web"] : [options.service];
for (const service of services) {
  const pattern = new RegExp(`^([ \\t]*image:[ \\t]*)[^\\s]+/quiz-${service}:[^\\s]+$`, "m");
  if (!pattern.test(updatedCompose)) throw new Error(`Cannot find quiz-${service} image in release/compose.yaml`);
  updatedCompose = updatedCompose.replace(pattern, `$1${options.namespace}/quiz-${service}:latest`);
}

for (const service of services) {
  const dockerfile = service === "api" ? "quiz-be/Dockerfile" : "quiz-fe/Dockerfile";
  const image = `${options.namespace}/quiz-${service}:${options.tag}`;
  const latestImage = `${options.namespace}/quiz-${service}:latest`;
  const args = ["buildx", "build", "--platform", "linux/amd64", "--file", dockerfile, "--tag", image, "--tag", latestImage, "--push", "."];
  console.log(`\nPublishing ${image} and ${latestImage}`);
  if (options.dryRun) {
    console.log(`docker ${args.join(" ")}`);
    continue;
  }
  const result = spawnSync("docker", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Publishing ${image} failed with exit code ${result.status}`);
}

if (options.dryRun) {
  console.log("\nDry run: no image was pushed and release/compose.yaml was not changed.");
} else {
  writeFileSync(composePath, updatedCompose, "utf8");
  console.log(`\nPublished ${services.join(" and ")} as version ${options.tag} and latest.`);
  console.log("The target machine needs release/compose.yaml with :latest only once. Keep its existing .env, then run:");
  console.log(`docker compose -f compose.yaml pull ${services.join(" ")}`);
  console.log(`docker compose -f compose.yaml up -d --no-build ${services.join(" ")}`);
}
