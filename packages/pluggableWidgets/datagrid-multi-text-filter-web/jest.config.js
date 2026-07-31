const sharedConfig = require("@mendix/pluggable-widgets-tools/test-config/jest.config");

// The shared config's own `moduleNameMapper` key for the filter builders is the
// unanchored regex `"mendix/filters/builders"`, which matches as a *substring* of any
// specifier, not just the bare module name. Left in place, it would keep matching
// `@mendix/widget-plugin-test-utils/__mocks__/mendix/filters/builders.js` — the exact
// path our own mock below needs to `require()` — and redirect that require back to
// itself, returning its own not-yet-initialized (empty) exports. So this key must be
// dropped, not just shadowed by adding another key alongside it (Jest checks
// `moduleNameMapper` entries in order and the old one would still fire first).
const { "mendix/filters/builders": _unusedFilterBuildersStub, ...restMapper } = sharedConfig.moduleNameMapper;

module.exports = {
    ...sharedConfig,
    /** Prevent usage of "jest-react-hooks-shallow" as it breaks useResetEvent hook. */
    setupFilesAfterEnv: undefined,
    /**
     * `nanoevents` package is ESM module and because ESM is not supported by Jest yet
     * we mark `nanoevents` as a module that should be transformed by ts-jest.
     */
    transformIgnorePatterns: ["node_modules/(?!nanoevents)/"],
    /**
     * The shared config maps `mendix/filters/builders` to stubs that return undefined.
     * Point it at our local mock instead so specs can build real condition trees.
     * rootDir is `<package>/src`, so this resolves to src/__mocks__/filter-builders.js.
     * Anchored with `^...$` so it matches only the exact bare specifier — see comment
     * above on why the unanchored original had to be removed rather than shadowed.
     */
    moduleNameMapper: {
        ...restMapper,
        "^mendix/filters/builders$": "<rootDir>/__mocks__/filter-builders.js"
    }
};
