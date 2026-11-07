// match-usage
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335482437c9eb145885f65f12aa1 as matchUsage } from "./i01a1335482437c9eb145885f65f12aa1.ts";

const CRUD = [
	"crud <quid>",
	"crud <kind> <gist>... [--name <name>]",
	"crud <quid> --meta <source>",
];

test("binds positionals, repeats and options, in any option order", () => {
	assert.deepEqual(matchUsage(CRUD, ["crud", "q"]), { index: 0, args: { quid: "q" } });
	assert.deepEqual(matchUsage(CRUD, ["crud", "--name", "n", "memo", "a", "b"]), {
		index: 1,
		args: { name: "n", kind: "memo", gist: ["a", "b"] },
	});
	assert.deepEqual(matchUsage(CRUD, ["crud", "memo", "a"]), { index: 1, args: { name: undefined, kind: "memo", gist: ["a"] } });
	assert.deepEqual(matchUsage(CRUD, ["crud", "q", "--meta=-"]), { index: 2, args: { meta: "-", quid: "q" } });
	assert.deepEqual(matchUsage(CRUD, ["crud", "q", "--meta", "-"]), { index: 2, args: { meta: "-", quid: "q" } });
});

test("flags, optional positionals and dotted names", () => {
	const usages = ["record.dive [<feat>] [--free]"];
	assert.deepEqual(matchUsage(usages, ["record.dive"]), { index: 0, args: { free: false, feat: undefined } });
	assert.deepEqual(matchUsage(usages, ["record.dive", "--free", "f"]), { index: 0, args: { free: true, feat: "f" } });
});

test("refuses no match and more than one, listing the usages", () => {
	assert.throws(() => matchUsage(CRUD, ["crud", "q", "--bogus"]), /no usage matches `crud q --bogus`; usages:\n {2}crud <quid>\n/);
	assert.throws(() => matchUsage(CRUD, ["crud", "q", "--meta"]), /no usage matches/);
	assert.throws(() => matchUsage(["x <a>", "x <b>"], ["x", "1"]), /matches more than one usage/);
});

test("an option family gathers each of its keys and values, in order, inline or not", () => {
	const usages = ["crud <kind> <gist>... [--meta:<path> <value>]... [--section:<path> <source>]..."];
	assert.deepEqual(matchUsage(usages, ["crud", "dive", "a", "b", "--meta:feat", "f", "--section:Brief", "-", "--meta:x.y=1"]), {
		index: 0,
		args: { "meta:": { feat: "f", "x.y": "1" }, "section:": { Brief: "-" }, kind: "dive", gist: ["a", "b"] },
	});
	assert.deepEqual(matchUsage(usages, ["crud", "dive", "a"]).args, { "meta:": {}, "section:": {}, kind: "dive", gist: ["a"] });
	assert.throws(() => matchUsage(usages, ["crud", "dive", "a", "--meta:feat", "f", "--meta:feat", "g"]), /no usage matches/, "a key given twice");
	assert.throws(() => matchUsage(usages, ["crud", "dive", "a", "--meta:", "f"]), /no usage matches/, "a family with no key");
	assert.throws(() => matchUsage(usages, ["crud", "dive", "a", "--meta:feat"]), /no usage matches/, "a key with no value");
});

test("a usage ending in <argv>... takes the rest of the command line, options too", () => {
	const usages = ["pass [<argv>...]"];
	assert.deepEqual(matchUsage(usages, ["pass", "--home", "q", "--sync"]), { index: 0, args: { argv: ["--home", "q", "--sync"] } });
	assert.deepEqual(matchUsage(usages, ["pass"]), { index: 0, args: { argv: undefined } });
	assert.throws(() => matchUsage(["pass [--x] <argv>..."], ["pass", "--home"]), /no usage matches/, "a usage with options parses them");
});
