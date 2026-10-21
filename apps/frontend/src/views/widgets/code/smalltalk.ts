import type { PrismLib } from 'prism-react-renderer';

// prism-react-renderer ships no Smalltalk grammar (Pharo, Moose…): a compact
// one, after Prism's own, registered on first use.
export function registerSmalltalk(prism: PrismLib): void {
  if (prism.languages.smalltalk) return;
  prism.languages.smalltalk = {
    comment: { pattern: /"(?:""|[^"])*"/, greedy: true },
    char: { pattern: /\$./, greedy: true },
    string: { pattern: /'(?:''|[^'])*'/, greedy: true },
    symbol: /#[\da-z]+|#(?:-|([+/\\*~<>=@%|&?!])\1?)|#(?=\()/i,
    'block-arguments': {
      pattern: /(\[\s*):[^[|]*\|/,
      lookbehind: true,
      inside: { variable: /:[\da-z]+/i, punctuation: /\|/ },
    },
    'temporary-variables': { pattern: /\|[^|]+\|/, inside: { variable: /[\da-z]+/i, punctuation: /\|/ } },
    keyword: /\b(?:nil|self|super|true|false|thisContext)\b/,
    number: [/\d+r-?[\dA-Z]+(?:\.[\dA-Z]+)?(?:e-?\d+)?/, /\b\d+(?:\.\d+)?(?:e-?\d+)?/],
    operator: /[<=]=?|:=|~[~=]|\/\/?|\\\\|>[>=]?|[!^+\-*&|,@]/,
    punctuation: /[.;:?[\](){}]/,
  };
}
