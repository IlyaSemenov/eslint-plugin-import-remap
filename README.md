# eslint-plugin-import-remap

Remap imports with ESLint autofixes.

The plugin rewrites only the quoted module specifier and does not resolve files, read alias configuration, or regenerate import statements.

## Install

```sh
npm install --save-dev eslint eslint-plugin-import-remap
```

## Usage

Configure the plugin with ESLint flat config:

```js
import { defineConfig } from "eslint/config"
import importRemap from "eslint-plugin-import-remap"

export default defineConfig([
  {
    plugins: {
      "import-remap": importRemap,
    },
    rules: {
      "import-remap/remap": [
        "error",
        {
          mappings: [
            { from: "@blog/*", to: "#*" },
            { from: "@blog-saas/*", to: "#saas/*" },
            { from: "old-package", to: "new-package" },
          ],
        },
      ],
    },
  },
])
```

Running ESLint normally reports each matching specifier:

```text
Remap import "@blog/foo" to "#foo".
```

Running ESLint with `--fix` applies the replacement:

```ts
import foo from "@blog/foo"
// becomes: import foo from "#foo"
```

## Mappings

A mapping without `*` matches the entire module specifier exactly.

A mapping with `*` captures the text between the literal prefix and suffix and inserts that capture at `*` in `to`.
Both `from` and `to` must contain exactly one `*`, or neither may contain one.
General glob features such as `**` and multiple captures are intentionally unsupported.

Mapping precedence does not depend on array order.
An exact mapping wins over wildcard mappings.
Among wildcard mappings, the longest prefix before `*` wins, followed by the longest complete pattern when prefixes have equal length.
This is the specificity order used by Node.js [`package.json#imports` and `exports`](https://nodejs.org/api/esm.html#resolution-algorithm-specification) for the same single-wildcard pattern subset.

For example, the narrower mapping wins even when it appears later:

```js
{
  mappings: [
    { from: "@company/*", to: "#*" },
    { from: "@company/special/*", to: "#special/*" },
  ]
}
```

Each `from` value must be unique.

An optional `message` replaces the default diagnostic for one mapping:

```js
{
  mappings: [
    {
      from: "@blog/*",
      to: "#*",
      message: "Use internal # aliases.",
    },
  ]
}
```

## Supported syntax

The rule checks quoted module specifiers in these forms:

```ts
import value from "@blog/value"
import { value } from "@blog/value"
import "@blog/setup"

export { value } from "@blog/value"
export * from "@blog/value"

const module = await import("@blog/value")
```

Template literals and CommonJS `require()` calls are not checked.
