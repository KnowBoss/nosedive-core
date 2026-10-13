import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type Bridge = { dir: string; configPath: string; config: Record<string, unknown>; kbDir: string };

export function a01a1335485c67c95b7efdf2f0e03cfd6(start: string): Bridge | undefined {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const configPath = join(dir, ".nosedive", "config.yaml");
		if (existsSync(configPath)) {
			const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
			const kb = typeof config.kb === "string" ? config.kb : "kb";
			return { dir, configPath, config, kbDir: resolve(dir, kb) };
		}
		if (dirname(dir) === dir) return undefined;
	}
}
