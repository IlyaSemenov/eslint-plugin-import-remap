import { describe, expect, it } from "bun:test"

import importRemap from "eslint-plugin-import-remap"

import packageJson from "../package.json" with { type: "json" }

describe("plugin entrypoint", () => {
  it("exports plugin metadata and the remap rule", () => {
    expect(importRemap.meta).toEqual({
      name: packageJson.name,
      version: packageJson.version,
    })
    expect(importRemap.rules.remap).toBeDefined()
  })
})
