// home-copy
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "./i01a14ac0044f7142a4623b2b7eff2eb5.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

const ROOT = "0173dff7-6800-76b9-8f17-797a694df5b2";
const bridge = (config: Record<string, unknown>, id: string | undefined = ROOT): Bridge => ({
	dir: resolve("bridge"),
	configPath: "",
	config,
	id,
	roots: [],
	kbDir: "",
	root: undefined,
	workspace: undefined,
});

test("names the home copy by the repo's name hashed with the bridge's id, an older one's root", () => {
	// mi's nosedive home copy, named before this function existed.
	assert.equal(homeCopy(bridge({ home: "x:/srv/repos" }), "nosedive"), join(resolve("x:/srv/repos"), "b0494610-143b-5d06-857d-263b9e1f9443.git"));
	assert.equal(homeCopy(bridge({ home: "../repos" }), "nosedive"), join(resolve("repos"), "b0494610-143b-5d06-857d-263b9e1f9443.git"));
	assert.notEqual(homeCopy(bridge({ home: "/r" }, "01a14ac0-044f-7142-a462-3b2b7eff2eb5"), "nosedive"), homeCopy(bridge({ home: "/r" }), "nosedive"));
});

test("is nothing without a home, and refuses a home that is no path or a bridge with no id", () => {
	assert.equal(homeCopy(bridge({}), "nosedive"), undefined);
	assert.throws(() => homeCopy(bridge({ home: 3 }), "nosedive"), /config `home` must be a path/);
	assert.throws(() => homeCopy(bridge({ home: "/r" }, ""), "nosedive"), /no id/);
});
