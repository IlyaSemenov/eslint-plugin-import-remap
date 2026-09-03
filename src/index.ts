import packageJson from "../package.json" with { type: "json" }
import { remap } from "./rules/remap"

/** ESLint plugin entrypoint for module-specifier remapping rules. */
const plugin = {
  meta: {
    // Reading package metadata prevents ESLint's cache identity from drifting after a release.
    name: packageJson.name,
    version: packageJson.version,
  },
  configs: {},
  processors: {},
  rules: {
    remap,
  },
}

export default plugin
