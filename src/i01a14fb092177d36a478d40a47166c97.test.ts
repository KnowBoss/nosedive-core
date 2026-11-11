// gate-usage
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";

test("reads the sect and kind a gate usage starts with, any kind for <quid>, and nothing from any other usage", () => {
	assert.deepEqual(gateUsage("pass --ready <device> [--deep]"), { sect: "ready", kind: "device" });
	assert.deepEqual(gateUsage("pass --test <quid>"), { sect: "test", kind: undefined });
	assert.equal(gateUsage("pass [<argv>...]"), undefined);
	assert.equal(gateUsage("crud <quid>"), undefined);
	assert.equal(gateUsage("pass --ready <device>x"), undefined);
});

test("reads a hook gate's sect, kind and when", () => {
	assert.deepEqual(gateUsage("after crud dive"), { sect: "crud", kind: "dive", when: "after" });
	assert.deepEqual(gateUsage("before crud example:task"), { sect: "crud", kind: "example:task", when: "before" });
	assert.equal(gateUsage("after crud <quid>"), undefined);
	assert.equal(gateUsage("during crud dive"), undefined);
});
