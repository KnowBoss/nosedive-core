import { join } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

export function i01a13c760de87562b4738946402010b8(bridge: Bridge, name: string): string {
	if (bridge.workspace === undefined) {
		throw new Error(`${name} cannot be checked out here: only a base has a workspace (\`nosedive seed --root-kind base\`)`);
	}
	return join(bridge.workspace, name);
}
