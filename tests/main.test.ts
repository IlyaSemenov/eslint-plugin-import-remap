import { describe, expect, it } from "bun:test"

import importRemap from "eslint-plugin-import-remap"

describe("plugin entrypoint", () => {
  it("exports plugin metadata and the remap rule", () => {
    expect(importRemap.meta).toEqual({
      name: "eslint-plugin-import-remap",
      version: "0.0.0",
    })
    expect(importRemap.rules.remap).toBeDefined()
  })
})
