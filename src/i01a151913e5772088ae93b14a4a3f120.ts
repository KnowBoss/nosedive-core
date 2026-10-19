import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export function i01a151913e5772088ae93b14a4a3f120(dir: string): void {
	const manifest = join(dir, "package.json");
	if (!existsSync(manifest)) return;
	const dependencies = (JSON.parse(readFileSync(manifest, "utf8")) as { dependencies?: Record<string, string> }).dependencies ?? {};
	if (Object.keys(dependencies).length === 0) return;
	const lockfile = join(dir, "package-lock.json");
	if (!existsSync(lockfile)) throw new Error(`${basename(dir)} names npm packages but has no package-lock.json to pin them`);

	const hash = createHash("sha256").update(readFileSync(lockfile)).digest("hex");
	const marker = join(dir, "node_modules", ".nosedive-lockfile");
	if (existsSync(marker) && readFileSync(marker, "utf8") === hash) return;
	// npm is a .cmd on Windows, which only a shell runs; the arguments are fixed.
	const npm = spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32" });
	if (npm.error) throw new Error(`installing ${basename(dir)}'s packages needs npm: ${npm.error.message}`);
	if (npm.status !== 0) throw new Error(`npm ci in ${basename(dir)} failed: ${(npm.stderr || npm.stdout).trim()}`);
	writeFileSync(marker, hash);

	// A clone of its own keeps node_modules out of git; a worktree's .git is a file, and its repo is the user's.
	const exclude = join(dir, ".git", "info", "exclude");
	if (existsSync(join(dir, ".git")) && statSync(join(dir, ".git")).isDirectory()) {
		const text = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
		if (!/^\/?node_modules\/?$/m.test(text)) appendFileSync(exclude, `${text && !text.endsWith("\n") ? "\n" : ""}node_modules/\n`);
	}
}
