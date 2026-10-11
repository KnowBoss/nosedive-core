#!/usr/bin/env node
// Builds the core bundle, dist/core-<version>.js, and the shims that name it: dist/cli.js, dist/nosedive.js.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const licence = readFileSync(join(root, "LICENSE"), "utf8").trim();

const commands = new Set();
for (const file of readdirSync(join(root, "kb"))) {
	if (!file.endsWith(".md")) continue;
	const text = readFileSync(join(root, "kb", file), "utf8");
	if (!/^kind: command$/m.test(text)) continue;
	const name = /^name: ([^@\s]+)@\d+$/m.exec(text)?.[1];
	if (name && !name.startsWith("_")) commands.add(name);
}

const name = `core-${version}`;
await build({
	entry: { [name]: "src/core.ts" },
	format: ["esm"],
	target: "node22",
	platform: "node",
	minify: true,
	splitting: false,
	clean: true,
	noExternal: [/.*/],
	silent: true,
	// CommonJS dependencies require node builtins; an ESM bundle has no `require` of its own.
	banner: {
		js: `/*!\n${licence}\n*/\nimport { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);`,
	},
	define: {
		__CORE_VERSION__: JSON.stringify(version),
		__CORE_COMMANDS__: JSON.stringify([...commands].sort()),
	},
});

const bundle = join(root, "dist", `${name}.js`);
writeFileSync(
	join(root, "dist", "cli.js"),
	`#!/usr/bin/env node\nimport { main } from "./${name}.js";\nmain();\n`,
);
// A stable name for what imports the library by path: gate scripts and the gate runner.
writeFileSync(join(root, "dist", "nosedive.js"), `export * from "./${name}.js";\n`);
const sha256 = createHash("sha256").update(readFileSync(bundle)).digest("hex");
console.log(`${name}.js ${statSync(bundle).size} bytes sha256 ${sha256}`);
