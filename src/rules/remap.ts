import type { Rule } from "eslint"

/** Describes one exact or single-wildcard module-specifier replacement. */
export interface Mapping {
  /** Exact source specifier or a pattern containing one `*` capture. */
  from: string

  /** Exact replacement or a pattern receiving the capture at its `*`. */
  to: string

  /** Diagnostic text that overrides the rule's default message. */
  message?: string
}

/** Configuration accepted by the `remap` rule. */
export interface RemapOptions {
  /** Candidate mappings, resolved by Node-style pattern specificity. */
  mappings: Mapping[]
}

/** A mapping together with the concrete specifier it produced. */
interface Match {
  mapping: Mapping
  target: string
}

/** An ESTree string literal with the range required for a targeted fix. */
type StringLiteral = Rule.Node & {
  type: "Literal"
  value: string
  range: [number, number]
}

/**
 * Narrows parser output to a quoted string literal that ESLint can safely fix.
 *
 * @param node Candidate AST value.
 * @returns Whether the candidate contains a string value and source range.
 */
function isStringLiteral(node: unknown): node is StringLiteral {
  if (typeof node !== "object" || node === null) return false

  const candidate = node as Record<string, unknown>

  // ImportExpression may contain any expression, while export/import declarations use literals.
  return (
    candidate.type === "Literal" &&
    typeof candidate.value === "string" &&
    Array.isArray(candidate.range) &&
    candidate.range.length === 2
  )
}

/**
 * Reads the common `source` property from the supported import and export nodes.
 *
 * @param node ESLint visitor node.
 * @returns The source AST value when the node carries one.
 */
function getSource(node: Rule.Node): unknown {
  if (!("source" in node)) return undefined

  return node.source
}

/**
 * Applies one exact or single-capture mapping to a module specifier.
 *
 * @param source Module specifier to test.
 * @param mapping Candidate mapping.
 * @returns The replacement specifier, or `undefined` when the mapping does not match.
 */
function applyMapping(source: string, mapping: Mapping): string | undefined {
  const wildcardIndex = mapping.from.indexOf("*")

  if (wildcardIndex === -1) {
    return source === mapping.from ? mapping.to : undefined
  }

  const prefix = mapping.from.slice(0, wildcardIndex)
  const suffix = mapping.from.slice(wildcardIndex + 1)

  if (
    source.length < prefix.length + suffix.length ||
    !source.startsWith(prefix) ||
    !source.endsWith(suffix)
  ) {
    return undefined
  }

  const captureEnd = suffix.length === 0 ? source.length : -suffix.length
  // The schema guarantees one `*` in both sides, so the middle substring is the sole capture.
  const capture = source.slice(prefix.length, captureEnd)

  return mapping.to.replace("*", capture)
}

/**
 * Orders wildcard mappings by Node's `PATTERN_KEY_COMPARE` specificity rules.
 *
 * @param a First wildcard mapping.
 * @param b Second wildcard mapping.
 * @returns A sort comparator result with the more specific mapping first.
 * @see https://nodejs.org/api/esm.html#resolution-algorithm-specification
 */
function patternKeyCompare(a: Mapping, b: Mapping): number {
  const patternIndexA = a.from.indexOf("*")
  const patternIndexB = b.from.indexOf("*")

  // Node prefers the longest literal prefix, then the longest full pattern (suffix included).
  if (patternIndexA > patternIndexB) return -1
  if (patternIndexB > patternIndexA) return 1
  if (a.from.length > b.from.length) return -1
  if (b.from.length > a.from.length) return 1

  return 0
}

/**
 * Validates mapping identity and precomputes order-independent match precedence.
 *
 * @param mappings User-configured mappings.
 * @returns A new array with exact mappings before specificity-sorted wildcard mappings.
 * @throws When multiple mappings use the same `from` value.
 */
function prepareMappings(mappings: Mapping[]): Mapping[] {
  const exactMappings: Mapping[] = []
  const wildcardMappings: Mapping[] = []
  const sources = new Set<string>()

  for (const mapping of mappings) {
    // Node package maps are objects and therefore cannot represent competing identical keys.
    if (sources.has(mapping.from)) {
      throw new Error(
        `Duplicate mapping source "${mapping.from}". Each "from" value must be unique.`,
      )
    }

    sources.add(mapping.from)

    if (mapping.from.includes("*")) wildcardMappings.push(mapping)
    else exactMappings.push(mapping)
  }

  // Distinct exact keys cannot overlap, so their relative order is immaterial.
  return [...exactMappings, ...wildcardMappings.sort(patternKeyCompare)]
}

/**
 * Finds the highest-precedence mapping that accepts a module specifier.
 *
 * @param source Module specifier to remap.
 * @param mappings Prepared mappings in resolution order.
 * @returns The selected mapping and replacement, if any.
 */
function findMatch(source: string, mappings: Mapping[]): Match | undefined {
  for (const mapping of mappings) {
    const target = applyMapping(source, mapping)

    if (target !== undefined) return { mapping, target }
  }

  return undefined
}

/**
 * Escapes replacement text for insertion between existing string delimiters.
 *
 * @param value Replacement module specifier.
 * @param quote Quote delimiter used by the original literal.
 * @returns Escaped literal content without surrounding quotes.
 */
function escapeForQuote(value: string, quote: string): string {
  // JSON.stringify supplies correct control-character and backslash escaping for double quotes.
  const jsonContent = JSON.stringify(value).slice(1, -1)

  // Single-quoted literals additionally need apostrophes escaped; JSON escapes remain valid JS.
  return quote === "'" ? jsonContent.replaceAll("'", "\\'") : jsonContent
}

/** Autofixable ESLint rule that remaps literal ESM module specifiers. */
export const remap = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Remap imports with ESLint autofixes",
      url: "https://github.com/IlyaSemenov/eslint-plugin-import-remap#readme",
    },
    fixable: "code",
    languages: ["js/js"],
    messages: {
      remap: 'Remap import "{{source}}" to "{{target}}".',
    },
    schema: [
      {
        type: "object",
        properties: {
          mappings: {
            type: "array",
            minItems: 1,
            items: {
              oneOf: [
                {
                  type: "object",
                  properties: {
                    from: { type: "string", minLength: 1, pattern: "^[^*]*$" },
                    to: { type: "string", pattern: "^[^*]*$" },
                    message: { type: "string", minLength: 1 },
                  },
                  required: ["from", "to"],
                  additionalProperties: false,
                },
                {
                  type: "object",
                  properties: {
                    from: {
                      type: "string",
                      pattern: "^[^*]*\\*[^*]*$",
                    },
                    to: {
                      type: "string",
                      pattern: "^[^*]*\\*[^*]*$",
                    },
                    message: { type: "string", minLength: 1 },
                  },
                  required: ["from", "to"],
                  additionalProperties: false,
                },
              ],
            },
          },
        },
        required: ["mappings"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const mappings = prepareMappings(
      (context.options[0] as RemapOptions | undefined)?.mappings ?? [],
    )
    const sourceCode = context.sourceCode

    /** Reports and fixes a supported node when its literal source matches a mapping. */
    function check(node: Rule.Node) {
      const sourceNode = getSource(node)

      if (!isStringLiteral(sourceNode)) return

      const source = sourceNode.value
      const match = findMatch(source, mappings)

      if (!match || match.target === source) return

      const raw = sourceCode.getText(sourceNode)
      const quote = raw.startsWith("'") ? "'" : '"'
      const replacement = escapeForQuote(match.target, quote)
      const report = {
        node: sourceNode,
        fix(fixer: Rule.RuleFixer) {
          // Excluding the delimiters preserves the user's original quote style and statement layout.
          return fixer.replaceTextRange(
            [sourceNode.range[0] + 1, sourceNode.range[1] - 1],
            replacement,
          )
        },
      }

      if (match.mapping.message) {
        context.report({ ...report, message: match.mapping.message })
        return
      }

      context.report({
        ...report,
        messageId: "remap",
        data: { source, target: match.target },
      })
    }

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check,
    }
  },
} satisfies Rule.RuleModule
