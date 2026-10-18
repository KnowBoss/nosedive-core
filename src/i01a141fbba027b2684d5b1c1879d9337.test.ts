// action-clashes
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a141fbba027b2684d5b1c1879d9337 as actionClashes } from "./i01a141fbba027b2684d5b1c1879d9337.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";

const core: Cape = await sourceCape();

test("names each action two capes provide, or a cape and core both do", () => {
	const clashes = actionClashes(core, [
		{ name: "a", actions: { greet: "Greets", scaf: "Mine" } },
		{ name: "b", actions: { greet: "Also greets", wave: "Waves" } },
	]);
	assert.deepEqual(clashes, ["scaf is provided by core and a", "greet is provided by a and b"]);
});

test("finds none among capes that each provide their own", () => {
	assert.deepEqual(actionClashes(core, [{ name: "a", actions: { greet: "Greets" } }, { name: "b", actions: { wave: "Waves" } }]), []);
});
