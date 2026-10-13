#!/usr/bin/env node
// Fails when this repo's action docs and its files disagree.
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "../src/a01a1335488937f1c8c3983dd2950028e.ts";
import { repoDir } from "./source-cape.mjs";

const problems = checkCapeSource(repoDir);
for (const problem of problems) console.error(`check: ${problem}`);
if (problems.length > 0) process.exitCode = 1;
