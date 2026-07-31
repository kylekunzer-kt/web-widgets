// `mendix/filters/builders` ships types only — no runtime JS. The shared
// pluggable-widgets-tools Jest config maps it to bare jest.fn() stubs that return
// undefined, and the canonical mock in @mendix/widget-plugin-test-utils omits the
// `contains` and `startsWith` builders this widget is built on. So: delegate to the
// canonical mock for what it does provide, and add the string operators.
//
// Operator name strings must match the real mendix/filters union exactly — they are
// what termsFromCond and the shared condition-utils helpers switch on.
const canonical = require("@mendix/widget-plugin-test-utils/__mocks__/mendix/filters/builders.js");

const binary = name => (arg1, arg2) => ({ type: "function", name, arg1, arg2 });

module.exports = {
    ...canonical,
    contains: binary("contains"),
    startsWith: binary("starts-with"),
    endsWith: binary("ends-with"),
    greaterThan: binary(">"),
    greaterThanOrEqual: binary(">="),
    lessThan: binary("<"),
    lessThanOrEqual: binary("<=")
};
