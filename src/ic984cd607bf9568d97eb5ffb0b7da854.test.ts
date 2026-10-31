// scaf [<quid>]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { parse, stringify } from "yaml";
import { CANONICAL, CORE, checkedOut, gitRepo, kbOf, ok, run, tempBridge, tempDir } from "../test/harness.ts";

const ACTION = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const HELPER = "01a1335b-f30a-7dd2-a1d4-b675fd419238";

async function capeRepo(): Promise<string> {
	const dir = gitRepo("scaf");
	ok(await run(["seed", "--root-kind", "cape"], dir));
	writeFileSync(
		join(dir, "kb", `${ACTION}.md`),
		`---\nkind: action\nid: ${ACTION}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n${CANONICAL}---\n`,
	);
	writeFileSync(join(dir, "kb", `${HELPER}.md`), `---\nkind: function\nid: ${HELPER}\nname: shout\ngist: "Shouts"\n${CANONICAL}---\n`);
	return dir;
}

test("writes every missing file, then nothing on a second run", async () => {
	const dir = await capeRepo();
	const out = ok(await run(["scaf"], dir));
	const lines = out.split("\n").map((line) => line.trim());
	assert.equal(lines[0], `${basename(dir)}:`);
	const created = lines.filter((line) => line.startsWith("created ")).map((line) => line.slice(8));
	assert.deepEqual(lines.filter((line) => line.startsWith("updated ")).sort(), [`updated kb/${ACTION}.md`, `updated kb/${HELPER}.md`]);
	const docs = [ACTION, HELPER].map((id) => `src/i${id.replace(/-/g, "")}.ts`);
	const usage = created.find((file) => /^src\/i[0-9a-f]{32}\.ts$/.test(file) && !docs.includes(file))!;
	const hex = usage.slice(5, 37);
	assert.deepEqual(created.sort(), [
		`src/i${ACTION.replace(/-/g, "")}.ts`,
		`src/i${HELPER.replace(/-/g, "")}.ts`,
		`src/i${hex}.ts`,
		`src/i${HELPER.replace(/-/g, "")}.test.ts`,
		`src/i${hex}.test.ts`,
	].sort());
	assert.match(readFileSync(join(dir, `src/i${ACTION.replace(/-/g, "")}.ts`), "utf8"), new RegExp(`case "u${hex}": // greet <who>`));
	assert.equal(ok(await run(["scaf"], dir)), `${basename(dir)}:\n  nothing to scaffold`);
});

test("a gate's usage gets an impl taking the pass's GateCtx, routed from call.gate, and no test", async () => {
	const dir = await capeRepo();
	writeFileSync(
		join(dir, "kb", `${ACTION}.md`),
		`---\nkind: action\nid: ${ACTION}\nname: ready\ngist: "Readies"\nmeta:\n  usages:\n    - pass --ready <device>\n${CANONICAL}---\n`,
	);
	const out = ok(await run(["scaf", ACTION], dir));
	const impl = /created src\/(i[0-9a-f]{32})\.ts/g;
	const files = [...out.matchAll(impl)].map((match) => match[1]!).filter((name) => name !== `i${ACTION.replace(/-/g, "")}`);
	assert.equal(files.length, 1);
	assert.doesNotMatch(out, /created src\/i[0-9a-f]{32}\.test\.ts/);
	assert.match(readFileSync(join(dir, "src", `${files[0]}.ts`), "utf8"), /export async function i[0-9a-f]{32}\(ctx: GateCtx\)/);
	assert.match(readFileSync(join(dir, "src", `i${ACTION.replace(/-/g, "")}.ts`), "utf8"), new RegExp(`return ${files[0]}\\(call\\.gate!\\);`));
	assert.doesNotMatch(out, /\n {4}ready /, "nothing left to do for the gate");
});

test("one action only, and lists what it cannot fix", async () => {
	const dir = await capeRepo();
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src", "stray.ts"), "export {};\n");
	const out = ok(await run(["scaf", HELPER], dir));
	assert.match(out, /created src\/i01a1335bf30a7dd2a1d4b675fd419238\.ts/);
	assert.deepEqual(out.match(/created src\/\S+/g), ["created src/i01a1335bf30a7dd2a1d4b675fd419238.ts", "created src/i01a1335bf30a7dd2a1d4b675fd419238.test.ts"], "only the chosen doc's code");
	assert.match(out, /still to do:\n(.|\n)*greet .*missing src\/i01a1335bf2537b80ab64d2f9a03c9634\.ts/);
	assert.match(out, /src\/stray\.ts: no doc accounts for it/);
	assert.equal(existsSync(join(dir, "src", "stray.ts")), true);
});

test("runs in a cape outside core, whose code imports core's types by name", async () => {
	const dir = gitRepo("scaf-base");
	ok(await run(["seed", "--root-kind", "cape"], dir));
	writeFileSync(join(dir, "kb", `${ACTION}.md`), `---\nkind: action\nid: ${ACTION}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n${CANONICAL}---\n`);
	assert.match(ok(await run(["scaf", ACTION], dir)), /created src\/i01a1335bf2537b80ab64d2f9a03c9634\.ts/);
	assert.match(readFileSync(join(dir, "src", "i01a1335bf2537b80ab64d2f9a03c9634.ts"), "utf8"), /from "nosedive-core"/);
});


/** How a walk names a repo: its path from the hero, or the hero's own name for the hero. */
const labelOf = (hero: string, repo: string) => relative(hero, repo).split(sep).join("/") || basename(hero);

const entryFile = (id: string) => `src/i${id.replace(/-/g, "")}.ts`;

function actionDoc(kbDir: string, id: string, name: string): void {
	mkdirSync(kbDir, { recursive: true });
	writeFileSync(join(kbDir, `${id}.md`), `---\nkind: action\nid: ${id}\nname: ${name}\ngist: "${name}"\nmeta:\n  usages:\n    - ${name}\n${CANONICAL}---\n`);
}

/** Seeds a directory by hand as a cape, as a local cape or a checkout the hero cannot seed from inside. */
function seededCape(dir: string, name: string): void {
	const root = mintUuid();
	mkdirSync(join(dir, ".nosedive"), { recursive: true });
	mkdirSync(join(dir, "kb"), { recursive: true });
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${root}\nroots:\n  - kb/${root}.md\n`);
	writeFileSync(join(dir, "kb", `${root}.md`), `---\nkind: cape\nid: ${root}\nname: ${name}\n${CANONICAL}---\n`);
}

/** The lines a walk printed under each repo's name. */
function groups(out: string): Record<string, string[]> {
	const found: Record<string, string[]> = {};
	let current = "";
	for (const line of out.split("\n")) {
		if (!line.startsWith(" ")) found[(current = line.slice(0, -1))] = [];
		else found[current]!.push(line.trim());
	}
	return found;
}

async function walkFixture() {
	const hero = await tempBridge("scaf-walk");
	const ids = { hero: mintUuid(), local: mintUuid(), checkout: mintUuid(), plain: mintUuid(), ignored: mintUuid() };
	actionDoc(kbOf(hero), ids.hero, "hero-cmd");
	seededCape(join(hero, "capes", "local"), "local");
	actionDoc(join(hero, "capes", "local", "kb"), ids.local, "local-cmd");
	const checkout = checkedOut(hero, "wscape");
	seededCape(checkout, "wscape");
	actionDoc(join(checkout, "kb"), ids.checkout, "checkout-cmd");
	// A checkout that was never seeded.
	const plain = checkedOut(hero, "plain");
	actionDoc(join(plain, "kb"), ids.plain, "plain-cmd");
	// Directories a walk never enters.
	for (const dir of ["node_modules/pkg", ".git/refs/stray", ".nosedive/capes/built"]) actionDoc(join(hero, dir), ids.ignored, "ignored-cmd");
	return { hero, local: join(hero, "capes", "local"), checkout, plain, ids };
}

test("--base at the hero's directory scaffolds each action in the repo holding it, grouped by repo", async () => {
	const { hero, local, checkout, plain, ids } = await walkFixture();
	// An existing file is left alone.
	mkdirSync(join(checkout, "src"));
	writeFileSync(join(checkout, entryFile(ids.checkout)), "// mine\n");

	const out = ok(await run(["--base", hero, "scaf"], hero));
	const found = groups(out);
	const created = (repo: string, id: string) => found[labelOf(hero, repo)]!.includes(`created ${entryFile(id)}`);
	assert.ok(created(hero, ids.hero));
	assert.ok(created(local, ids.local));
	assert.ok(!created(checkout, ids.checkout), "an existing entrypoint is not rewritten");
	assert.equal(readFileSync(join(checkout, entryFile(ids.checkout)), "utf8"), "// mine\n");
	assert.ok(found[labelOf(hero, checkout)]!.some((line) => line.startsWith("created src/") && line.endsWith(".test.ts")));
	assert.ok(existsSync(join(local, entryFile(ids.local))));
	assert.ok(!existsSync(join(hero, entryFile(ids.local))), "a local cape's action is not written into the hero");
	assert.ok(found[basename(hero)]!.every((line) => !line.includes(ids.local.replace(/-/g, ""))));
	assert.deepEqual(found.skipped, [`workspace/plain/kb/${ids.plain}.md: in no seeded repo`]);
	assert.ok(!existsSync(join(plain, "src")));
	assert.doesNotMatch(out, new RegExp(ids.ignored), "node_modules, .git and .nosedive/capes are never entered");
});

test("the default walk covers the home base only", async () => {
	const { hero, local, checkout, ids } = await walkFixture();
	const found = groups(ok(await run(["scaf"], hero)));
	assert.deepEqual(Object.keys(found), [basename(hero)]);
	assert.ok(existsSync(join(hero, entryFile(ids.hero))));
	assert.ok(!existsSync(join(local, "src")));
	assert.ok(!existsSync(join(checkout, "src")));
});

test("scaf <quid> scaffolds that action wherever its doc lives, and refuses what it cannot", async () => {
	const { hero, local, checkout, plain, ids } = await walkFixture();
	const found = groups(ok(await run(["scaf", ids.checkout], hero)));
	assert.deepEqual(Object.keys(found), [labelOf(hero, checkout)]);
	assert.ok(existsSync(join(checkout, entryFile(ids.checkout))));
	assert.ok(!existsSync(join(hero, "src")));

	ok(await run(["scaf", ids.local], hero));
	assert.ok(existsSync(join(local, entryFile(ids.local))), "found in a local cape, which crud does not search");

	const unseeded = await run(["scaf", ids.plain], hero);
	assert.equal(unseeded.code, 1);
	assert.match(unseeded.err, /workspace\/plain\/kb\/.*: in no seeded repo/);
	assert.ok(!existsSync(join(plain, "src")));
	assert.match((await run(["scaf", mintUuid()], hero)).err, /no doc .* in .* or its workspace/);
});

test("reports an action in a seeded repo that is neither a cape nor a hero, and refuses a place with no config", async () => {
	const repo = gitRepo("scaf-neither");
	ok(await run(["seed"], repo));
	const id = mintUuid();
	actionDoc(kbOf(repo), id, "stray");
	const out = ok(await run(["scaf"], repo));
	assert.match(out, new RegExp(`^skipped:\n {2}kb/${id}\\.md: ${basename(repo)} is neither a cape nor a hero repo$`));
	assert.ok(!existsSync(join(repo, "src")));

	const bare = await run(["scaf"], gitRepo("scaf-bare"));
	assert.equal(bare.code, 1);
	assert.match(bare.err, /there is no nosedive config here or above/);
});

test("scaffolds an action doc from any root of its repo, which --base accepts", async () => {
	const hero = await tempBridge("scaf-roots");
	const root = mintUuid();
	const config = join(hero, ".nosedive", "config.yaml");
	const parsed = parse(readFileSync(config, "utf8")) as { roots: string[] };
	parsed.roots.push(`more/${root}.md`);
	writeFileSync(config, stringify(parsed));
	mkdirSync(join(hero, "more"));
	writeFileSync(join(hero, "more", `${root}.md`), `---\nkind: base\nid: ${root}\nname: more\n${CANONICAL}---\n`);
	const id = mintUuid();
	actionDoc(join(hero, "more"), id, "more-cmd");

	const out = ok(await run(["--base", "more", "scaf"], hero));
	assert.ok(out.includes(`created ${entryFile(id)}`));
	assert.ok(out.includes(`updated more/${id}.md`));
	assert.ok(existsSync(join(hero, entryFile(id))));
	assert.match(readFileSync(join(hero, "more", `${id}.md`), "utf8"), /## Code/);
	assert.doesNotMatch(out, /no doc accounts for/, "the files scaf wrote for it are accounted for");
	assert.equal(ok(await run(["scaf", id], hero)), `${basename(hero)}:\n  nothing to scaffold`);
});

test("reports a doc it cannot read, or one in an unseeded repo that looks like an action, and refuses them for scaf <quid>", async () => {
	const hero = await tempBridge("scaf-errors");
	const [good, broken, twin, bare] = [mintUuid(), mintUuid(), mintUuid(), mintUuid()];
	actionDoc(kbOf(hero), good, "good-cmd");
	writeFileSync(join(kbOf(hero), `${broken}.md`), `---\nkind: action\nid: ${broken}\nname: [oops\n---\n`);
	const twinned = checkedOut(hero, "twinned");
	seededCape(twinned, "twinned");
	actionDoc(join(twinned, "kb"), mintUuid(), "fine-cmd");
	writeFileSync(join(twinned, "kb", `${twin}.md`), `---\nkind: action\nid: ${twin}\nname: twin\nscopes:\n  - ${CORE}:\n      canonical: true\n  - ${mintUuid()}:\n      canonical: true\n---\n`);
	const plain = checkedOut(hero, "plain");
	writeFileSync(join(plain, "kb", `${bare}.md`), `---\nkind: action\nid: ${bare}\nname: bare\n---\n`);

	const found = groups(ok(await run(["--base", hero, "scaf"], hero)));
	const lines = found[basename(hero)]!;
	assert.ok(lines.includes(`created ${entryFile(good)}`), "the readable doc is still scaffolded");
	assert.ok(lines.some((line) => line.startsWith(`error kb/${broken}.md: `)));
	const twinLines = found["workspace/twinned"]!;
	assert.ok(twinLines.some((line) => line.startsWith(`error kb/${twin}.md: `) && line.includes("more than one canonical scope")));
	assert.ok(twinLines.some((line) => line.startsWith("error: ") && line.includes("more than one canonical scope")), "a repo that cannot be read whole is reported, and the walk goes on");
	assert.deepEqual(found.skipped, [`workspace/plain/kb/${bare}.md: in no seeded repo`]);

	for (const [id, message] of [[broken, `${broken}.md: `], [twin, "more than one canonical scope"], [bare, "in no seeded repo"]]) {
		const refused = await run(["scaf", id!], hero);
		assert.equal(refused.code, 1);
		assert.ok(refused.err.includes(message!), refused.err);
	}
});

test("takes a quid in any case and nothing else", async () => {
	const { hero, checkout, ids } = await walkFixture();
	const bad = await run(["scaf", "../../x"], hero);
	assert.equal(bad.code, 1);
	assert.ok(bad.err.includes("not a quid: ../../x"), bad.err);
	ok(await run(["scaf", ids.checkout.toUpperCase()], hero));
	assert.ok(existsSync(join(checkout, entryFile(ids.checkout))));
});

test("names repos by their path from the hero, so two of one name differ", async () => {
	const hero = await tempBridge("scaf-names");
	const local = join(hero, "capes", "foo");
	seededCape(local, "foo");
	actionDoc(join(local, "kb"), mintUuid(), "local-foo");
	const checkout = checkedOut(hero, "foo");
	seededCape(checkout, "foo");
	actionDoc(join(checkout, "kb"), mintUuid(), "checkout-foo");
	assert.deepEqual(Object.keys(groups(ok(await run(["--base", hero, "scaf"], hero)))).sort(), ["capes/foo", "workspace/foo"]);
});

test("does not follow a symlink, and lists it under its repo", async (t) => {
	const { hero, local, ids } = await walkFixture();
	const target = tempDir("scaf-link");
	const hidden = mintUuid();
	actionDoc(target, hidden, "hidden-cmd");
	try {
		symlinkSync(target, join(local, "linked"), "junction");
	} catch {
		t.skip("this platform cannot make a symlink here");
		return;
	}
	const out = ok(await run(["--base", hero, "scaf"], hero));
	assert.deepEqual(groups(out)["capes/local"]!.filter((line) => line.startsWith("not followed")), ["not followed: linked"]);
	assert.doesNotMatch(out, new RegExp(hidden));
	assert.ok(out.includes(`created ${entryFile(ids.local)}`));
});

test("NOSEDIVE_HERO=<checkout> scaffolds that checkout as the hero", async () => {
	const hero = await tempBridge("scaf-hero-env");
	const checkout = checkedOut(hero, "envcape");
	seededCape(checkout, "envcape");
	const id = mintUuid();
	actionDoc(join(checkout, "kb"), id, "env-cmd");
	assert.match((await run(["scaf"], checkout)).err, /a checkout is never a hero/);
	process.env.NOSEDIVE_HERO = checkout;
	try {
		const out = ok(await run(["scaf"], checkout));
		assert.ok(out.startsWith(`${basename(checkout)}:\n`));
		assert.ok(out.includes(`created ${entryFile(id)}`));
	} finally {
		delete process.env.NOSEDIVE_HERO;
	}
	assert.ok(existsSync(join(checkout, entryFile(id))));
});
