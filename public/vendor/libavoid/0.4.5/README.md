# libavoid WebAssembly runtime

`libavoid.wasm` and `LICENSE` are copied without modification from the pinned
`libavoid-js@0.4.5` npm package. The package's JavaScript binding is bundled and
minified into the application's client chunks; the WASM remains a separately served
asset. The application gives the required notice at `/third-party-licenses`.

- Copyright: libavoid, Copyright (C) 2004-2014 Monash University; libavoid-js,
  Vladyslav Hnatiuk.
- Binding source and build instructions: https://github.com/Aksem/libavoid-js/tree/v0.4.5
- Engine source: https://github.com/Aksem/adaptagrams/tree/v1.0.4
- License: LGPL-2.1-or-later; see the accompanying LICENSE.

To refresh these files after deliberately updating the pinned dependency:

```sh
cp node_modules/libavoid-js/dist/libavoid.wasm public/vendor/libavoid/0.4.5/libavoid.wasm
cp node_modules/libavoid-js/LICENSE public/vendor/libavoid/0.4.5/LICENSE
```

Update the versioned directory, the loader URL and that page together. Do not inline the WASM
into the application bundle.
