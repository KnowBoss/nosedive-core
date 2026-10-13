# nosedive-core

Private. nosedive's core cape: the launcher, the basic actions, and the functions other capes import.

Start from the kb, not the code: [the action kind](kb/01a13354-7d34-72f3-ad11-9c44b4d5de6e.md) says how action docs name their files.

```sh
npm run dev -- <action> [<args>]   # run from source, no build
npm run dev -- scaf                # write the files the action docs call for
npm test                           # the docs-and-files check, then every test
npm run build [-- --dev]           # dist/core.js and dist/cli.js; --dev builds uncommitted work
```
