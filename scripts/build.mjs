#!/usr/bin/env node
// Builds this repo into its cape, dist/core.js, and dist/cli.js that runs it.
// `--dev` builds a dirty tree, marked as such; `--minify` minifies.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { build } from "esbuild";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "../src/a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "../src/a01a1335488937f1c8c3983dd2950028e.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "../src/a01a133588c7971b5b116d9c8c1706e04.ts";
import { repoDir, repoId } from "./source-cape.mjs";

const dev = process.argv.includes("--dev");
const minify = process.argv.includes("--minify");
const git = (...args) => spawnSync("git", args, { cwd: repoDir, encoding: "utf8" }).stdout.trim();
const fail = (message) => {
	console.error(`build: ${message}`);
	process.exit(1);
};

const dirty = git("status", "--porcelain") !== "";
if (dirty && !dev) fail("the tree has uncommitted changes: commit them, or build with --dev");
const problems = checkCapeSource(repoDir);
if (problems.length > 0) fail(`the action docs and files disagree:\n  ${problems.join("\n  ")}`);

const head = git("rev-parse", "--verify", "-q", "HEAD");
if (!head) fail("nothing is committed yet");
const commit = dirty ? `${head}+dev` : head;
const id = namespacedUuid(commit, repoId());
// The calver labels the build for people; the id is what identifies it.
const seconds = Number(git("log", "-1", "--format=%ct"));
const date = new Date(seconds * 1000);
const millis = seconds * 1000 + (Number.parseInt(head.slice(0, 3), 16) % 1000);
const version = `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}-${millis}${dirty ? "-dev" : ""}`;
const { name } = JSON.parse(readFileSync(join(repoDir, "package.json"), "utf8"));

const source = describeCapeSource(repoDir);
const { names, entries } = capeIndex(source, id);
const buildDir = join(repoDir, "build");
const toEntry = (file) => `./${relative(buildDir, file).replace(/\\/g, "/")}`;
const entryText = [
	'import { consoleCtx, a01a1336a958f71c7beec4db3195c7966 as launch, type Cape } from "../src/a01a1336a958f71c7beec4db3195c7966.ts";',
	...Object.values(entries).map((entry) => `import { ${entry.name} } from ${JSON.stringify(toEntry(entry.file))};`),
	"",
	`export const id = ${JSON.stringify(id)};`,
	`export const name = ${JSON.stringify(name)};`,
	`export const commit = ${JSON.stringify(commit)};`,
	`export const version = ${JSON.stringify(version)};`,
	`export const docs: Cape["docs"] = ${JSON.stringify(source.docs)};`,
	"export const index: Cape[\"index\"] = {",
	...Object.entries(names).map(([key, docId]) => `\t${JSON.stringify(key)}: ${JSON.stringify(docId)},`),
	...Object.entries(entries).map(([key, entry]) => `\t${JSON.stringify(key)}: ${entry.name},`),
	"};",
	"",
	"export async function main(argv = process.argv.slice(2)): Promise<void> {",
	"\tprocess.exitCode = await launch(argv, consoleCtx([{ id, name, commit, version, docs, index }]));",
	"}",
	"",
].join("\n");

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir);
writeFileSync(join(buildDir, "entry.ts"), entryText);
const licence = readFileSync(join(repoDir, "LICENSE"), "utf8").trim();
const outfile = join(repoDir, "dist", "core.js");
await build({
	entryPoints: [join(buildDir, "entry.ts")],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	outfile,
	minify,
	// The CommonJS dependencies require node builtins, and an ESM bundle has no `require` of its own.
	banner: {
		js: `/*!\n${licence}\n*/\nimport { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);`,
	},
	logLevel: "warning",
});
writeFileSync(join(repoDir, "dist", "cli.js"), '#!/usr/bin/env node\nimport { main } from "./core.js";\n\nawait main();\n');

const sha256 = createHash("sha256").update(readFileSync(outfile)).digest("hex");
console.log(`${name} ${version}\n  id      ${id}\n  commit  ${commit}\n  file    dist/core.js, ${statSync(outfile).size} bytes, sha256 ${sha256}`);
