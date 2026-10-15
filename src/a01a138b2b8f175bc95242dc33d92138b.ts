import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { GateCtx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./a01a1335487e477549d84a6fc2c901bf6.ts";

export function a01a138b2b8f175bc95242dc33d92138b(ctx: GateCtx): void {
	if (!ctx.core.url) throw new Error(`core ${ctx.core.version} has no module the tests can import`);
	const tests = join(ctx.repoDir, "test");
	if (!existsSync(tests) || !readdirSync(tests).some((file) => file.endsWith(".test.ts"))) {
		throw new Error(`${basename(ctx.repoDir)} has no tests in test/`);
	}
	const dir = mkdtempSync(join(tmpdir(), "nosedive-tests-"));
	try {
		const modules: Record<string, string> = { "nosedive-core": ctx.core.url };
		for (const [name, repoDir] of workspaceCapes(ctx)) {
			const file = join(dir, `${name}.mjs`);
			const { entries } = describeCapeSource(repoDir);
			writeFileSync(file, entries.map((entry) => `export { ${entry.name} } from ${JSON.stringify(pathToFileURL(entry.file).href)};`).join("\n"));
			modules[name] = pathToFileURL(file).href;
		}
		const resolver = join(dir, "resolve.mjs");
		writeFileSync(
			resolver,
			[
				'import { registerHooks } from "node:module";',
				`const modules = ${JSON.stringify(modules)};`,
				"registerHooks({ resolve: (specifier, context, next) => (modules[specifier] ? { url: modules[specifier], shortCircuit: true } : next(specifier, context)) });",
				"",
			].join("\n"),
		);
		const run = spawnSync(
			process.execPath,
			["--disable-warning=ExperimentalWarning", "--import", pathToFileURL(resolver).href, "--test", "--test-reporter=spec", "test/*.test.ts"],
			// A test runner's own context would make the child skip its files as a nested run.
			{ cwd: ctx.repoDir, encoding: "utf8", env: { ...process.env, NODE_TEST_CONTEXT: undefined } },
		);
		const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trimEnd();
		if (output) ctx.out(output);
		if (run.status !== 0) throw new Error(`the tests of ${basename(ctx.repoDir)} failed`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** The cape repos checked out in the bridge's workspace, other than the one being tested. */
function workspaceCapes(ctx: GateCtx): [string, string][] {
	const bridge = findBridge(ctx.bridgeDir);
	if (bridge?.workspace === undefined) return [];
	const workspace = bridge.workspace;
	if (!existsSync(workspace)) return [];
	return readdirSync(workspace, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && resolve(workspace, entry.name) !== resolve(ctx.repoDir))
		.map((entry): [string, string] => [entry.name, join(workspace, entry.name)])
		.filter(([, repoDir]) => existsSync(join(repoDir, "kb")) && describeCapeSource(repoDir).entries.length > 0);
}
