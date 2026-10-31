import { writeFileSync } from "node:fs";
import { isScalar, visit, type Document, type Pair } from "yaml";

const FIRST = ["kind", "id", "name", "gist", "scopes", "meta"];

/**
 * Puts top-level keys in KINGSMETAL order: the known ones, any other in its existing order, then `links`. Values are untouched.
 * The comment above the first key stays on top, no key is left a blank line under `---`, and a doc with aliases keeps its order, since a move could put one before its anchor.
 */
export function kingsmetal(yaml: Document): void {
	const map = yaml.contents;
	if (!map || !("items" in map)) return;
	let aliased = false;
	visit(yaml, { Alias: () => { aliased = true; return visit.BREAK; } });
	if (aliased) return;
	const items = map.items as Pair[];
	const rank = (pair: Pair): number => {
		const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
		if (key === "links") return FIRST.length + 1;
		const at = FIRST.indexOf(key);
		return at < 0 ? FIRST.length : at;
	};
	const ranked = items.map((pair, at) => ({ pair, at, rank: rank(pair) })).sort((a, b) => a.rank - b.rank || a.at - b.at).map((each) => each.pair);
	if (ranked.every((pair, at) => pair === items[at])) return;
	const top = items[0] && isScalar(items[0].key) ? items[0].key : undefined;
	const header = top?.commentBefore;
	if (top) top.commentBefore = undefined;
	map.items = ranked;
	const head = ranked[0] && isScalar(ranked[0].key) ? ranked[0].key : undefined;
	if (head) {
		// A blank that led the new first key moves to the key under it, so it stays between keys.
		const next = ranked[1] && isScalar(ranked[1].key) ? ranked[1].key : undefined;
		if (head.spaceBefore && next) next.spaceBefore = true;
		head.spaceBefore = undefined;
		if (header != null) head.commentBefore = head.commentBefore ? `${header}\n${head.commentBefore}` : header;
	}
}

export function i01a1335483aa776cb84df698b04adc06(path: string, yaml: Document, body: string): void {
	kingsmetal(yaml);
	writeFileSync(path, `---\n${yaml.toString({ lineWidth: 0 })}---\n${body}`);
}
