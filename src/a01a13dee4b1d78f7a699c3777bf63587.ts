import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";

export function a01a13dee4b1d78f7a699c3777bf63587(dir: string): Bridge | undefined {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
	const text = (value: unknown) => (typeof value === "string" ? value : undefined);
	const kbDir = resolve(dir, text(config.kb) ?? "kb");
	const root = text(config.root ?? config.backlog);
	const rootDoc = root ? findKbDoc(kbDir, root) : undefined;
	const meta = (rootDoc?.fm.meta ?? {}) as { workspace?: unknown };
	const workspace = rootDoc?.fm.kind === "base" ? resolve(dir, text(meta.workspace) ?? "workspace") : undefined;
	return { dir: resolve(dir), configPath, config, kbDir, root, workspace };
}
