import { join, resolve } from "node:path";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./a01a13354850c7ba3ba5b8ac41a7b6b11.ts";

export function a01a13c760de87562b4738946402010b8(bridge: Bridge, name: string): string {
	if (typeof bridge.config.workspace !== "string") {
		throw new Error(`${name} cannot be checked out here: only a base has a workspace (\`nosedive seed --root-kind base\`)`);
	}
	const workspace = resolve(bridge.dir, bridge.config.workspace);
	const self = bridge.self !== undefined && listKbDocs(bridge.kbDir).some((doc) => doc.fm.kind === "repo" && doc.fm.name === name && doc.fm.id === bridge.self);
	return join(workspace, self ? "__self" : name);
}
