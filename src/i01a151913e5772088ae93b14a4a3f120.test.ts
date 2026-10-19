// install-cape-packages
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a151913e5772088ae93b14a4a3f120 as installCapePackages } from "./i01a151913e5772088ae93b14a4a3f120.ts";
import { gitRepo, lock, shoutPackage, tempDir } from "../test/harness.ts";

test("needs nothing without packages, and refuses packages no lockfile pins", () => {
	const dir = tempDir("install-none");
	installCapePackages(dir);
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", devDependencies: { shout: "1.0.0" } }));
	installCapePackages(dir);
	assert.equal(existsSync(join(dir, "node_modules")), false);
	shoutPackage(dir);
	assert.throws(() => installCapePackages(dir), /names npm packages but has no package-lock\.json to pin them/);
});

test("installs what the lockfile pins, once per lockfile, and keeps node_modules out of a clone's git", () => {
	const dir = gitRepo("install-shout");
	shoutPackage(dir);
	lock(dir);
	installCapePackages(dir);
	assert.equal(existsSync(join(dir, "node_modules", "shout", "index.js")), true);
	const marker = join(dir, "node_modules", ".nosedive-lockfile");
	const installed = statSync(marker).mtimeMs;
	rmSync(join(dir, "node_modules", "shout"), { recursive: true, force: true });
	installCapePackages(dir);
	assert.equal(statSync(marker).mtimeMs, installed, "the same lockfile is not installed again");
	assert.match(readFileSync(join(dir, ".git", "info", "exclude"), "utf8"), /^node_modules\/$/m);
	assert.equal(spawnSync("git", ["status", "--porcelain", "node_modules"], { cwd: dir, encoding: "utf8" }).stdout, "");
});
