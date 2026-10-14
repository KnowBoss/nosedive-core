import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type Bridge = {
	dir: string;
	configPath: string;
	config: Record<string, unknown>;
	kbDir: string;
	/** The id of the bridge's root doc: config `root`, or `backlog`, its older name. */
	root: string | undefined;
};

export function a01a1335485c67c95b7efdf2f0e03cfd6(start: string): Bridge | undefined {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const configPath = join(dir, ".nosedive", "config.yaml");
		if (existsSync(configPath)) {
			const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
			const kb = typeof config.kb === "string" ? config.kb : "kb";
			const root = config.root ?? config.backlog;
			return { dir, configPath, config, kbDir: resolve(dir, kb), root: typeof root === "string" ? root : undefined };
		}
		if (dirname(dir) === dir) return undefined;
	}
}
