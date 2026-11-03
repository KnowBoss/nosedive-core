# nosedive-core

nosedive's core cape: the launcher, the basic actions, and the functions other capes import. Free to use under the [MIT License](LICENSE).

**Development status:** Core is under active development and is not yet ready for general release. Commands, APIs, and file formats may change without backward compatibility. Use for experimentation and evaluation; avoid relying on it for critical workflows.

Start from [the root](kb/01a1336b-c0b8-7cde-b7c6-285196062297.md), not the code: it lists every action core exposes, with the functions each one uses under it, and each action's doc ends with links to its code. [The action kind](.nosedive/kinds/01a13354-7d34-72f3-ad11-9c44b4d5de6e.md) says how the docs name their files.

```sh
npm run dev -- <action> [<args>]   # run from source, no build
npm run dev -- scaf                # write the files the action docs call for
npm test                           # the docs-and-files check, then every test
npm run build [-- --dev]           # dist/core.js and dist/cli.js; --dev builds uncommitted work
```
