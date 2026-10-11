import { runCli } from "./nosedive.js";
import { packageContractDocs } from "./contractDocs.js";
import { readNosediveRc, uuidLike } from "./lib/coreParsing.js";
import { renderPackageKbGist } from "./lib/gitState.js";
import { nosediveInvocation } from "./lib/packageBacklog.js";

export * from "./nosedive.js";

/** Stamped by the build from package.json. */
declare const __CORE_VERSION__: string;
/** Stamped by the build: every free command's name, from the package kb. */
declare const __CORE_COMMANDS__: string[];

export const version = __CORE_VERSION__;
export const needs = {};

export const commands: Record<string, (args: string[]) => Promise<void>> = Object.fromEntries(
	__CORE_COMMANDS__.map((name) => [name, (args: string[]) => runCli([name, ...args])]),
);

/** Throws when this bundle cannot serve the bridge at `ctx.bridge`. */
export function smoke(ctx: { bridge: string }): void {
	const documented = new Set(packageContractDocs().map((doc) => doc.command));
	const missing = Object.keys(commands).filter((name) => !documented.has(name));
	if (missing.length > 0) {
		throw new Error(`core ${version}: no command doc for ${missing.join(", ")}`);
	}
	readNosediveRc(ctx.bridge);
}

/** Runs the command line, as `dist/cli.js` does. */
export function main(): void {
	runCli().catch((err: unknown) => {
		const message = err instanceof Error ? err.message : String(err);
		if (uuidLike(message)) {
			try {
				console.error(`nosedive-error: ${renderPackageKbGist(message)}`);
				console.error(`more info: ${nosediveInvocation()} render ${message}`);
			} catch {
				console.error(`nosedive: ${message}`);
			}
		} else {
			console.error(`nosedive: ${message}`);
		}
		process.exit(1);
	});
}
