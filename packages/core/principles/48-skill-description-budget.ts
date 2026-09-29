/**
 * Principle 48 — measurement half: how many bytes a SKILL.md puts into the harness's
 * resident skill listing.
 *
 * > **Authoritative for:** the extractor (what counts as listing text) and the budget
 * > evaluation. The budget NUMBERS live in the companion test, next to their rationale.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Description
 * > QUALITY (is the trigger wording any good) — `.claude/rules/skill-description-quality.md`.
 *
 * The harness lists `description` with `when_to_use` appended, and nothing else
 * (code.claude.com/docs/en/skills, frontmatter reference, fetched 2026-09-29). So exactly
 * those two values are measured. Measuring «from `description:` to the closing fence» swept
 * `allowed-tools` into the number (+11.4%, docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md
 * §2) — a gate on that would be satisfiable by deleting permissions.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SkillListingCost {
  /** Directory name under the population root. */
  skill: string;
  /** Repo-relative path of the SKILL.md. */
  file: string;
  /** UTF-8 bytes of `description` + `when_to_use`. */
  bytes: number;
  /** Characters of the same text — the unit of the harness's own per-entry cap. */
  chars: number;
  /** `disable-model-invocation: true` — the skill is absent from the listing. */
  hidden: boolean;
}

/**
 * Top-level frontmatter scalars, read leniently.
 *
 * Deliberately NOT a YAML parser: real descriptions are plain scalars that contain `: `
 * («… is broken. Triggers: aif-doctor, …»), which strict YAML rejects and the harness
 * accepts. A key is a column-0 `name:`. Its value is the rest of the line plus any indented
 * continuation lines (folded with a space, as YAML folds them), or — for `|` and `>`, with
 * or without chomping / indentation indicators — the indented block, dedented by its common
 * indent. Where this reader and YAML could differ, it errs towards counting MORE (a trailing
 * `# comment` is counted): an over-count fails loudly, an under-count passes silently.
 */
export function frontmatterOf(content: string): Record<string, unknown> {
  const m = /^\uFEFF?\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    content,
  );
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const out: Record<string, unknown> = {};
  const isContinuation = (l: string | undefined): l is string =>
    l !== undefined && (/^\s+\S/.test(l) || /^\s*$/.test(l));

  for (let i = 0; i < lines.length; i++) {
    const key = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/.exec(lines[i]);
    if (!key) continue;
    const rest = key[2].trim();
    const following: string[] = [];
    while (isContinuation(lines[i + 1])) following.push(lines[++i]);

    let value: string;
    if (/^[|>][+-]?\d?[+-]?$/.test(rest)) {
      const indents = following
        .filter((l) => l.trim() !== '')
        .map((l) => /^\s*/.exec(l)![0].length);
      const indent = indents.length ? Math.min(...indents) : 0;
      value = following
        .map((l) => l.slice(indent).replace(/\s+$/, ''))
        .join('\n')
        .trim();
    } else {
      value = [rest, ...following.map((l) => l.trim())]
        .filter((l) => l !== '')
        .join(' ');
      if (/^".*"$/s.test(value))
        value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
      else if (/^'.*'$/s.test(value))
        value = value.slice(1, -1).replace(/''/g, "'");
    }
    out[key[1]] = value === 'true' ? true : value === 'false' ? false : value;
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function listingCost(
  content: string,
): Pick<SkillListingCost, 'bytes' | 'chars' | 'hidden'> {
  const fm = frontmatterOf(content);
  const listed = text(fm.description) + text(fm.when_to_use);
  return {
    bytes: Buffer.byteLength(listed, 'utf8'),
    chars: [...listed].length,
    hidden: fm['disable-model-invocation'] === true,
  };
}

/** Every `<root>/<population>/<skill>/SKILL.md`, sorted by skill name. */
export function measurePopulation(
  repoRoot: string,
  population: string,
): SkillListingCost[] {
  const dir = join(repoRoot, population);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .filter((name) => existsSync(join(dir, name, 'SKILL.md')))
    .map((name) => ({
      skill: name,
      file: `${population}/${name}/SKILL.md`,
      ...listingCost(readFileSync(join(dir, name, 'SKILL.md'), 'utf8')),
    }));
}

export interface PopulationBudget {
  /** Repo-relative directory holding `<skill>/SKILL.md`. */
  population: string;
  /** Cap on the summed bytes of the skills the model can see. */
  totalMaxBytes: number;
}

export interface CeilingException {
  file: string;
  maxBytes: number;
  reason: string;
}

export interface BudgetRules {
  perSkillMaxBytes: number;
  /** The harness truncates an entry beyond this many characters. */
  vendorEntryMaxChars: number;
  populations: PopulationBudget[];
  exceptions: CeilingException[];
}

export function evaluate(
  rules: BudgetRules,
  measure: (population: string) => SkillListingCost[],
): string[] {
  const problems: string[] = [];
  const used = new Set<string>();

  for (const ex of rules.exceptions) {
    if (ex.reason.trim().length < 20)
      problems.push(
        `${ex.file}: a ceiling exception needs a rationale of at least 20 characters`,
      );
    if (ex.maxBytes <= rules.perSkillMaxBytes)
      problems.push(
        `${ex.file}: exception ceiling ${ex.maxBytes} B is not above the general cap ${rules.perSkillMaxBytes} B — delete the exception`,
      );
  }

  for (const { population, totalMaxBytes } of rules.populations) {
    const skills = measure(population);
    let total = 0;
    for (const s of skills) {
      const ex = rules.exceptions.find((e) => e.file === s.file);
      if (ex) used.add(ex.file);
      const cap = ex ? ex.maxBytes : rules.perSkillMaxBytes;
      if (s.bytes === 0)
        problems.push(
          `${s.file}: no readable description — a frontmatter this reader cannot parse must fail, not measure as 0 B`,
        );
      if (s.bytes > cap)
        problems.push(
          `${s.file}: description + when_to_use is ${s.bytes} B, cap ${cap} B — move workflow prose into the body, keep every trigger phrase`,
        );
      if (s.chars > rules.vendorEntryMaxChars)
        problems.push(
          `${s.file}: ${s.chars} characters — the harness cuts a listing entry at ${rules.vendorEntryMaxChars}, so the tail never reaches the model`,
        );
      if (!s.hidden) total += s.bytes;
    }
    if (total > totalMaxBytes) {
      const top = skills
        .filter((s) => !s.hidden)
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 3)
        .map((s) => `${s.skill} ${s.bytes} B`)
        .join(', ');
      problems.push(
        `${population}: model-visible descriptions total ${total} B, budget ${totalMaxBytes} B (largest: ${top})`,
      );
    }
  }

  for (const ex of rules.exceptions)
    if (!used.has(ex.file))
      problems.push(
        `${ex.file}: ceiling exception matches no measured skill — remove the stale entry`,
      );

  return problems;
}
