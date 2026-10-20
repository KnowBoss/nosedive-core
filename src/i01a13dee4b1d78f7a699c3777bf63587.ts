import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";

/** The keys a config may name its root under: by its kind, then the legacy names. */
export const ROOT_KEYS = ["ship", "cape", "base", "root", "backlog"];

export function i01a13dee4b1d78f7a699c3777bf63587(dir: string): Bridge | undefined {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
	const text = (value: unknown) => (typeof value === "string" ? value : undefined);
	const kbDir = resolve(dir, text(config.kb) ?? "kb");
	const roots = [...new Set(ROOT_KEYS.flatMap((key) => (text(config[key]) ? [text(config[key])!] : [])))];
	if (roots.length > 1) throw new Error(`${configPath} names more than one root: ${roots.join(", ")}`);
	const root = roots[0];
	const rootDoc = root ? findKbDoc(kbDir, root) : undefined;
	const meta = (rootDoc?.fm.meta ?? {}) as { workspace?: unknown };
	// A legacy base that carries a workspace is read as a ship.
	const hasWorkspace = rootDoc?.fm.kind === "ship" || (rootDoc?.fm.kind === "base" && text(meta.workspace) !== undefined);
	const workspace = hasWorkspace ? resolve(dir, text(meta.workspace) ?? "workspace") : undefined;
	return { dir: resolve(dir), configPath, config, kbDir, root, workspace };
}
