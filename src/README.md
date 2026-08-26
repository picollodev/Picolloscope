# TypeScript source

This directory contains the bulk of source code.

## Subdirectories

- `gl/`: WebGL code. This includes e.g. the code to render flamecharts.
- `import/`: Code to import profiles from Picollo
- `lib/`: Mostly dependency-less utilities. This includes e.g. an LRU cache implementation, basic linear algebra classes,
  and the definition of the file format.
- `app-state/`: Application state management
- `typings/`: [TypeScript definition files](https://basarat.gitbooks.io/typescript/docs/types/ambient/d.ts.html)
- `views/`: View code to generate the HTML & CSS used to construct the UI. Implemented using [`preact`](https://preactjs.com/) and [`aphrodite`](https://github.com/Khan/aphrodite).
