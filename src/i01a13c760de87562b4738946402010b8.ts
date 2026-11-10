import { join } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

export function i01a13c760de87562b4738946402010b8(bridge: Bridge, name: string): string {
	if (bridge.workspace === undefined) {
		throw new Error(`${name} cannot be checked out here: only a hero repo has a workspace (\`nosedive seed --workspace\`)`);
	}
	return join(bridge.workspace, pathComponent(name, "a repo's name"));
}

/** Refuses a name that is not one path component, so a path built from it stays under its root; returns it. */
export function pathComponent(name: string, what: string): string {
	if (name === "" || name === "." || name === ".." || /[/\\:\x00-\x1f\x7f]/.test(name)) {
		throw new Error(`${what}, ${JSON.stringify(name)}, is no single path component, so nothing was checked out`);
	}
	return name;
}
