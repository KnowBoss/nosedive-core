// render-tree
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a14a5504467ef08586b828ebabc148 as renderTree } from "./i01a14a5504467ef08586b828ebabc148.ts";
import { tempDir } from "../test/harness.ts";

const ROOT = "01a14a55-daf8-73a2-b087-548601fb73bf";
const REPO = "01a14a55-daf9-7d3d-8d75-50a24f2e8c42";
const LEVEL = "01a14a55-dafa-7beb-b493-ea12b0a7ead0";
const GOAL = "01a14a55-dafb-7165-871e-9a71d4dc190b";
const KIND = "01a14a55-dafc-77a8-816f-b6a700e3dbbd";

const doc = (kbDir: string, id: string, kind: string, name: string, gist: string, links: [string, string][], title?: string) =>
	writeFileSync(
		join(kbDir, `${id}.md`),
		`---\nkind: ${kind}\nid: ${id}\nname: ${name}\ngist: "${gist}"\n${links.length ? `links:\n${links.map(([target, rel]) => `  - ${target}:\n      rel: ${rel}\n`).join("")}` : ""}---\n${title ? `\n# ${title}\n` : ""}`,
	);

test("renders each feat group of the root, walking child.feat to any depth, any kind", () => {
	const kb = tempDir("render-tree");
	doc(kb, REPO, "repo", "nosedive", "The repo", [[`kb/${LEVEL}.md`, "child.feat"], [`kb/${ROOT}.md`, "parent.feat"]], "Nosedive");
	doc(kb, LEVEL, "memo", "free", "Core alone", [[`kb/${GOAL}.md`, "child.feat"], [`kb/${REPO}.md`, "child.feat"]]);
	doc(kb, GOAL, "goal", "cutover", "Runs on core", [], "Cutover");
	doc(kb, KIND, "kind", "memo", "A note", [], "Memo");
	const root = {
		fm: { id: ROOT, links: [{ [`kb/${REPO}.md`]: { rel: "software.feat" } }, { [KIND]: { rel: "kinds.feat" } }, { [`kb/${REPO}.md`]: { rel: "parent.feat" } }, { "other-repo:x": { rel: "kinds.feat" } }] },
		body: "\n# Mi\n\nStale.\n",
	};
	assert.equal(
		renderTree(kb, root),
		[
			"",
			"# Mi",
			"",
			"## Kinds",
			"",
			`- [Memo](${KIND}.md): A note`,
			"",
			"## Software",
			"",
			`- [Nosedive](${REPO}.md): The repo`,
			`  - [free](${LEVEL}.md): Core alone`,
			`    - [Cutover](${GOAL}.md): Runs on core`,
			"",
		].join("\n"),
		"the level's link back to the repo is a revisit, so it is left out",
	);
});

test("a root with no feat links renders as its title alone", () => {
	assert.equal(renderTree(tempDir("render-tree-empty"), { fm: { id: ROOT, name: "bare" }, body: "" }), "\n# bare\n");
});

test("links from a root kept outside the kb, as a kind file, into the kb", () => {
	const dir = tempDir("render-tree-kind-file");
	const kb = join(dir, "kb");
	mkdirSync(kb);
	doc(kb, LEVEL, "memo", "free", "Core alone", [], "Free");
	const root = { fm: { id: ROOT, links: [{ [`kb/${LEVEL}.md`]: { rel: "levels.feat" } }] }, body: "", path: join(dir, ".nosedive", "cape.md") };
	assert.match(renderTree(kb, root), /^- \[Free\]\(\.\.\/kb\/01a14a55-dafa-7beb-b493-ea12b0a7ead0\.md\): Core alone$/m);
});

test("finds a feat kept outside the kb, as a repo doc in .nosedive/repos/, linking it by its path from the root", () => {
	const dir = tempDir("render-tree-repos");
	const kb = join(dir, "kb");
	const repos = join(dir, ".nosedive", "repos");
	mkdirSync(kb);
	mkdirSync(repos, { recursive: true });
	doc(repos, REPO, "repo", "nosedive", "The repo", [], "Nosedive");
	const root = { fm: { id: ROOT, links: [{ [`kb/${REPO}.md`]: { rel: "software.feat" } }] }, body: "", path: join(kb, `${ROOT}.md`) };
	assert.doesNotMatch(renderTree(kb, root), /Nosedive/, "not looked for outside the kb unless named");
	assert.match(renderTree(kb, root, [repos]), new RegExp(`^- \\[Nosedive\\]\\(\\.\\./\\.nosedive/repos/${REPO}\\.md\\): The repo$`, "m"));
});
