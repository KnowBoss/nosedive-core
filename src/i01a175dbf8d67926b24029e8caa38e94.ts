import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";

/** Kinds whose root becomes a base; any other is kept. */
const PLAIN = ["memo", "base"];

export function i01a175dbf8d67926b24029e8caa38e94(dir: string): string[] {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath)) return [];
	const config = parseDocument(readFileSync(configPath, "utf8"));
	if (config.has("roots")) return [];
	const root = typeof config.get("backlog") === "string" ? String(config.get("backlog")) : undefined;
	if (!root) throw new Error(`${configPath} names no backlog, so there is no root to list in roots`);
	const kb = typeof config.get("kb") === "string" ? String(config.get("kb")) : "./kb";
	const kbDir = join(dir, kb);
	const changed: string[] = [configPath];

	const rootDoc = findKbDoc(kbDir, root);
	if (!rootDoc) throw new Error(`the root ${root} is not in ${kbDir}`);
	if (PLAIN.includes(String(rootDoc.fm.kind))) {
		rootDoc.yaml.set("kind", "base");
		rootDoc.yaml.delete("meta");
		writeKbDoc(rootDoc.path, rootDoc.yaml, rootDoc.body);
		changed.push(rootDoc.path);
	}

	// Kinds and repos are kept in .nosedive/, shared by every root.
	for (const file of readdirSync(kbDir).filter((name) => name.endsWith(".md"))) {
		const path = join(kbDir, file);
		const kind = readKbDoc(readFileSync(path, "utf8")).fm.kind;
		if (kind !== "kind" && kind !== "repo") continue;
		const to = join(dir, ".nosedive", kind === "kind" ? "kinds" : "repos", file);
		mkdirSync(join(to, ".."), { recursive: true });
		renameSync(path, to);
		changed.push(path, to);
	}

	const workspace = typeof config.get("workspace") === "string" ? String(config.get("workspace")) : existsSync(join(dir, "workspace")) ? "./workspace" : undefined;
	for (const key of ["backlog", "kb"]) config.delete(key);
	config.set("id", root);
	if (workspace !== undefined) config.set("workspace", workspace);
	config.set("roots", [`${relative(dir, kbDir).replace(/\\/g, "/")}/${root}.md`]);
	writeFileSync(configPath, config.toString({ lineWidth: 0 }));
	return changed;
}
