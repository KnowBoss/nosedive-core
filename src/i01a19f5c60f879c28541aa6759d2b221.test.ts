// agent-surface
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a19f5c60f879c28541aa6759d2b221 as writeAgentSurface, SURFACE_BEGIN, SURFACE_END, surfaceDigest, surfaceDrift } from "./i01a19f5c60f879c28541aa6759d2b221.ts";
import { git, gitRepo, ok, run, tempDir } from "../test/harness.ts";

const SURFACE = "Usage: nosedive [--at <target>] <action> [<args>]\n\ncore 1.0\n  seed  Makes a bridge\n";
const STAMP = `<!-- nosedive v=1.0 surface=${surfaceDigest(SURFACE)} -->`;
const BLOCK = [
	STAMP,
	"",
	"- Instructions in `nosedive` output come first.",
	"- A line starting `nose:` is a call to attention: handle it before any other work.",
	"- When the pilot needs help finding work, run `nosedive next`.",
	"",
	"```",
	SURFACE.trim(),
	"```",
].join("\n");

test("fills the block between the markers of every marked file, keeping all text outside them, and leaves unmarked files alone", () => {
	const dir = tempDir("agent-surface");
	writeFileSync(join(dir, "CLAUDE.md"), `# Mine\n\nKept above.\n${SURFACE_BEGIN}\nstale\n${SURFACE_END}\nKept below.\n`);
	writeFileSync(join(dir, "AGENTS.md"), "# Agents\n\nNo markers here.\n");
	mkdirSync(join(dir, ".github"));
	writeFileSync(join(dir, ".github", "copilot-instructions.md"), `${SURFACE_BEGIN}\n${SURFACE_END}\n`);
	const written = writeAgentSurface(dir, SURFACE, "1.0");
	assert.deepEqual(written, { changed: [join(dir, "CLAUDE.md"), join(dir, ".github", "copilot-instructions.md")] });
	assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), `# Mine\n\nKept above.\n${SURFACE_BEGIN}\n${BLOCK}\n${SURFACE_END}\nKept below.\n`);
	assert.equal(readFileSync(join(dir, ".github", "copilot-instructions.md"), "utf8"), `${SURFACE_BEGIN}\n${BLOCK}\n${SURFACE_END}\n`);
	assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Agents\n\nNo markers here.\n", "a file without markers is never touched");
	assert.equal(existsSync(join(dir, "GEMINI.md")), false, "nothing is created while some instruction file exists");
	assert.deepEqual(writeAgentSurface(dir, SURFACE, "1.0"), { changed: [] }, "a block that already reads the same is unchanged");
});

test("stamps core's version and the digest of the surface, the first 8 hex of its sha256, trimmed", () => {
	assert.match(surfaceDigest(SURFACE), /^[0-9a-f]{8}$/);
	assert.equal(surfaceDigest(`\n${SURFACE}\n\n`), surfaceDigest(SURFACE), "two renderings of the same surface agree");
	assert.notEqual(surfaceDigest(`${SURFACE}  more  Another action\n`), surfaceDigest(SURFACE));
	const dir = tempDir("agent-surface-stamp");
	writeFileSync(join(dir, "AGENTS.md"), `${SURFACE_BEGIN}\n${SURFACE_END}\n`);
	writeAgentSurface(dir, SURFACE, "2026.11.3-1");
	assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8").split("\n")[1], `<!-- nosedive v=2026.11.3-1 surface=${surfaceDigest(SURFACE)} -->`);
});

test("fences the surface with more backticks than any run in it", () => {
	const dir = tempDir("agent-surface-fence");
	writeFileSync(join(dir, "AGENTS.md"), `${SURFACE_BEGIN}\n${SURFACE_END}\n`);
	writeAgentSurface(dir, "help with ```code``` in it", "1.0");
	assert.match(readFileSync(join(dir, "AGENTS.md"), "utf8"), /\n````\nhelp with ```code``` in it\n````\n/);
});

test("creates AGENTS.md with the block when no instruction file exists", () => {
	const dir = tempDir("agent-surface-none");
	assert.deepEqual(writeAgentSurface(dir, SURFACE, "1.0"), { changed: [join(dir, "AGENTS.md")] });
	assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${SURFACE_BEGIN}\n${BLOCK}\n${SURFACE_END}\n`);
});

test("when files exist but none is marked, writes nothing and hints at the marker lines", () => {
	const dir = tempDir("agent-surface-unmarked");
	writeFileSync(join(dir, "CLAUDE.md"), "# Mine\n");
	writeFileSync(join(dir, "GEMINI.md"), `${SURFACE_BEGIN}\nan end marker never comes\n`);
	const written = writeAgentSurface(dir, SURFACE, "1.0");
	assert.deepEqual(written.changed, []);
	assert.equal(
		written.hint,
		`no agent instruction file has the nosedive placeholder: paste these two lines into one of AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md, then run nosedive seed again:\n  ${SURFACE_BEGIN}\n  ${SURFACE_END}`,
	);
	assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), "# Mine\n");
	assert.equal(existsSync(join(dir, "AGENTS.md")), false);
});

test("drift names each marked file whose stamp shows another surface or none, without nose:", () => {
	const dir = tempDir("agent-surface-drift");
	writeFileSync(join(dir, "AGENTS.md"), `${SURFACE_BEGIN}\n${BLOCK}\n${SURFACE_END}\n`);
	writeFileSync(join(dir, "CLAUDE.md"), `${SURFACE_BEGIN}\nhand-written, no stamp\n${SURFACE_END}\n`);
	writeFileSync(join(dir, "GEMINI.md"), "no markers\n");
	assert.deepEqual(surfaceDrift(dir, SURFACE), ["CLAUDE.md's agent instructions do not match this nosedive: run nosedive seed"]);
	assert.deepEqual(surfaceDrift(dir, `${SURFACE}  next  Lists what is left\n`), [
		"AGENTS.md's agent instructions do not match this nosedive: run nosedive seed",
		"CLAUDE.md's agent instructions do not match this nosedive: run nosedive seed",
	]);
	assert.deepEqual(surfaceDrift(tempDir("agent-surface-empty"), SURFACE), [], "missing files say nothing");
});

test("launch reports drift on stderr before an action runs, never for seed, and says nothing once seed has written the surface", async () => {
	const hero = gitRepo("agent-surface-launch");
	ok(await run(["seed"], hero));
	assert.equal(git(["log", "-1", "--format=%s"], hero), `seed: ${hero.split("/").at(-1)} agent surface written`);
	const clean = await run(["mint"], hero);
	assert.equal(clean.err, "", "the block seed wrote matches the surface");
	writeFileSync(join(hero, "AGENTS.md"), readFileSync(join(hero, "AGENTS.md"), "utf8").replace(/surface=[0-9a-f]{8}/, "surface=00000000"));
	const drifted = await run(["mint"], hero);
	assert.equal(drifted.code, 0);
	assert.match(drifted.out, /^[0-9a-f-]{36}$/, "stdout stays the action's");
	assert.equal(drifted.err, "AGENTS.md's agent instructions do not match this nosedive: run nosedive seed");
	const reseeded = await run(["seed"], hero);
	assert.equal(reseeded.err, "", "seed reports no drift: it rewrites the block");
	assert.equal(reseeded.code, 0);
	assert.equal(git(["status", "--porcelain"], hero), "", "the hand edit is undone, and with HEAD's block back there is nothing to commit");
	assert.equal((await run(["mint"], hero)).err, "");
});

test("seed prints the hint when instruction files exist but none is marked, and writes no surface for a local cape", async () => {
	const hero = gitRepo("agent-surface-hint");
	writeFileSync(join(hero, "CLAUDE.md"), "# Mine\n");
	git(["add", "CLAUDE.md"], hero);
	git(["commit", "-qm", "instructions"], hero);
	const out = ok(await run(["seed"], hero));
	assert.match(out, /no agent instruction file has the nosedive placeholder/);
	assert.equal(readFileSync(join(hero, "CLAUDE.md"), "utf8"), "# Mine\n");
	assert.equal(existsSync(join(hero, "AGENTS.md")), false);
	ok(await run(["--at", "tools/spec", "seed", "--root-kind", "cape"], hero));
	assert.equal(existsSync(join(hero, "tools", "spec", "AGENTS.md")), false);
	ok(await run(["seed"], join(hero, "tools", "spec")));
	assert.equal(existsSync(join(hero, "tools", "spec", "AGENTS.md")), false, "nor from inside it");
});
