import { writeFileSync } from "node:fs";
import { isScalar, type Document, type Pair } from "yaml";

const FIRST = ["kind", "id", "name", "gist", "scopes", "meta"];

/** Puts top-level keys in KINGSMETAL order: the known ones, any other in its existing order, then `links`. Values are untouched. */
export function kingsmetal(yaml: Document): void {
	const map = yaml.contents;
	if (!map || !("items" in map)) return;
	const rank = (pair: Pair): number => {
		const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
		if (key === "links") return FIRST.length + 1;
		const at = FIRST.indexOf(key);
		return at < 0 ? FIRST.length : at;
	};
	const ranked = (map.items as Pair[]).map((pair, at) => ({ pair, at, rank: rank(pair) }));
	ranked.sort((a, b) => a.rank - b.rank || a.at - b.at);
	map.items = ranked.map((each) => each.pair);
}

export function i01a1335483aa776cb84df698b04adc06(path: string, yaml: Document, body: string): void {
	kingsmetal(yaml);
	writeFileSync(path, `---\n${yaml.toString({ lineWidth: 0 })}---\n${body}`);
}
