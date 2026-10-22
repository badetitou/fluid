import type { z } from 'zod';

type Issue = z.core.$ZodIssue;

const touchesType = (issues: Issue[]) =>
  issues.some((i) => i.path.length === 1 && i.path[0] === 'type');

/**
 * Flattens zod issues into readable lines. A widget is a union (built-in or
 * plugin), so a wrong widget yields one `invalid_union` issue holding every
 * branch's errors: keep the branch that recognised the `type`, which is the one
 * telling what is actually wrong.
 */
export function flattenIssues(issues: Issue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors.length > 0) {
      const branch = issue.errors.find((b) => !touchesType(b)) ?? issue.errors[0];
      return flattenIssues(branch, path);
    }
    return [`${path.map(String).join('.') || '(root)'}: ${issue.message}`];
  });
}

/** The first `max` problems of a zod error, one per line. */
export function describeIssues(error: z.ZodError, max = 8): string {
  return flattenIssues(error.issues).slice(0, max).join('\n');
}
