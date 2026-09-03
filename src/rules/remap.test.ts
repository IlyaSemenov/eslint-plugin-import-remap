import { describe, expect, it } from "bun:test"

import { Linter, RuleTester } from "eslint"

import { remap } from "./remap"

const mappings = {
  mappings: [
    { from: "@blog/*", to: "#*" },
    { from: "@blog-saas/*", to: "#saas/*" },
    { from: "old-package", to: "new-package" },
  ],
}

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
})

ruleTester.run("remap", remap, {
  valid: [
    { code: 'import value from "#foo"', options: [mappings] },
    { code: 'import value from "@blogger/foo"', options: [mappings] },
    { code: 'import value from "some-@blog/foo"', options: [mappings] },
    { code: 'import value from "unrelated-package"', options: [mappings] },
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This is an ESLint source fixture.
    { code: "import(`@blog/${name}`)", options: [mappings] },
  ],
  invalid: [
    {
      code: 'import value from "@blog/foo"',
      output: 'import value from "#foo"',
      options: [mappings],
      errors: [
        {
          messageId: "remap",
          data: { source: "@blog/foo", target: "#foo" },
        },
      ],
    },
    {
      code: 'import { value } from "@blog/foo/bar"',
      output: 'import { value } from "#foo/bar"',
      options: [mappings],
      errors: 1,
    },
    {
      code: "import '@blog-saas/foo'",
      output: "import '#saas/foo'",
      options: [mappings],
      errors: 1,
    },
    {
      code: 'export { value } from "@blog/foo"',
      output: 'export { value } from "#foo"',
      options: [mappings],
      errors: 1,
    },
    {
      code: 'export * from "@blog/foo"',
      output: 'export * from "#foo"',
      options: [mappings],
      errors: 1,
    },
    {
      code: 'import("@blog/foo")',
      output: 'import("#foo")',
      options: [mappings],
      errors: 1,
    },
    {
      code: 'import value from "old-package"',
      output: 'import value from "new-package"',
      options: [mappings],
      errors: 1,
    },
    {
      code: 'import value from "@company/special/foo"',
      output: 'import value from "#special/foo"',
      options: [
        {
          mappings: [
            { from: "@company/*", to: "#first/*" },
            { from: "@company/special/*", to: "#special/*" },
          ],
        },
      ],
      errors: 1,
    },
    {
      code: 'import value from "@company/special"',
      output: 'import value from "#exact"',
      options: [
        {
          mappings: [
            { from: "@company/*", to: "#wildcard/*" },
            { from: "@company/special", to: "#exact" },
          ],
        },
      ],
      errors: 1,
    },
    {
      code: 'import value from "@company/foo/internal"',
      output: 'import value from "#internal/foo"',
      options: [
        {
          mappings: [
            { from: "@company/*", to: "#generic/*" },
            { from: "@company/*/internal", to: "#internal/*" },
          ],
        },
      ],
      errors: 1,
    },
    {
      code: 'import value from "@blog/foo"',
      output: 'import value from "#foo"',
      options: [
        {
          mappings: [
            {
              from: "@blog/*",
              to: "#*",
              message: "Use internal # aliases.",
            },
          ],
        },
      ],
      errors: [{ message: "Use internal # aliases." }],
    },
  ],
})

describe("remap configuration", () => {
  it("rejects duplicate mapping sources", () => {
    const linter = new Linter()

    expect(() =>
      linter.verify('import value from "@company/foo"', [
        {
          plugins: {
            test: { rules: { remap } },
          },
          rules: {
            "test/remap": [
              "error",
              {
                mappings: [
                  { from: "@company/*", to: "#one/*" },
                  { from: "@company/*", to: "#two/*" },
                ],
              },
            ],
          },
        },
      ]),
    ).toThrow('Duplicate mapping source "@company/*"')
  })
})
