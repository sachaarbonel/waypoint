#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { formatJsonReport, formatMarkdownReport, formatSarifReport, formatTextReport } from "./reporters/index";
import { applySafeFixes } from "./fixes/index";
import { installSkillBundles } from "./skills/index";
import { scanWorkspace } from "./analyzer/index";
import { defaultIgnorePatterns, loadConfig } from "./config";
import { discoverWorkspace } from "./workspace";
import { normalizePath } from "./utils/fs";

type Format = "text" | "json" | "sarif" | "markdown";
type CommandName = "scan" | "fix" | "init" | "doctor" | "skill-install";
type HelpTopic = "root" | CommandName;

interface ParsedArgs {
  cwd: string;
  scope?: string;
  format: Format;
  output?: string;
  since?: string;
  changedOnly?: boolean;
  maxFindings?: number;
  minScore?: number;
  rule?: string;
  apply?: boolean;
  dryRun?: boolean;
}

type CliInvocation =
  | {
      kind: "help";
      topic: HelpTopic;
    }
  | {
      kind: "command";
      command: CommandName;
      parsed: ParsedArgs;
    };

const rootHelp = `Usage: wayweft <command> [options]

Commands:
  scan            Analyze a workspace or selected scope
  report          Alias for scan
  fix             Preview or apply safe rewrites
  doctor          Check workspace discovery and scan health
  init            Write a starter config and skill bundles
  skill install   Install the Wayweft skill bundle into a target repo

Common flags:
  --cwd <path>    Run a command against a target repository
  --help          Show help for the root command or a subcommand

Examples:
  wayweft --help
  wayweft scan --cwd /path/to/repo --scope workspace --format text
  wayweft fix --cwd /path/to/repo --dry-run
  wayweft doctor --cwd /path/to/repo
  wayweft skill install --cwd /path/to/repo`;

const commandHelp: Record<HelpTopic, string> = {
  root: rootHelp,
  scan: `Usage: wayweft scan [options]

Analyze a workspace or selected scope.

Options:
  --cwd <path>         Run against a target repository
  --scope <value>      workspace | package:<name> | path:<path> | changed | since:<ref>
  --format <value>     text | json | markdown | sarif
  --output <path>      Write the rendered report to a file
  --since <ref>        Git ref used with changed/since scopes
  --changed-only       Limit analysis to changed files
  --max-findings <n>   Cap the number of findings returned
  --min-score <n>      Override the minimum score threshold
  --rule <ruleId>      Limit output to a single rule
  --help               Show this help

Examples:
  wayweft scan --cwd /path/to/repo --scope workspace --format text
  wayweft scan --cwd /path/to/repo --scope changed --since origin/main --format sarif`,
  fix: `Usage: wayweft fix [options]

Preview or apply safe cleanup rewrites.

Options:
  --cwd <path>       Run against a target repository
  --scope <value>    workspace | package:<name> | path:<path> | changed | since:<ref>
  --since <ref>      Git ref used with changed/since scopes
  --min-score <n>    Override the minimum score threshold
  --rule <ruleId>    Limit fixes to a single rule
  --apply            Apply the safe rewrites
  --dry-run          Preview fixes without editing files
  --help             Show this help

Examples:
  wayweft fix --cwd /path/to/repo --dry-run
  wayweft fix --cwd /path/to/repo --scope package:web --rule prefer-optional-chaining --apply`,
  doctor: `Usage: wayweft doctor [options]

Check workspace discovery and basic scan health.

Options:
  --cwd <path>     Run against a target repository
  --help           Show this help

Example:
  wayweft doctor --cwd /path/to/repo`,
  init: `Usage: wayweft init [options]

Write a starter config and install local Wayweft guidance files.

Options:
  --cwd <path>     Initialize a target repository
  --help           Show this help

Example:
  wayweft init --cwd /path/to/repo`,
  "skill-install": `Usage: wayweft skill install [options]

Install the portable Wayweft skill bundle into a target repository.

Options:
  --cwd <path>     Install into a target repository
  --help           Show this help

Example:
  wayweft skill install --cwd /path/to/repo`,
};

export async function main(argv = process.argv.slice(2), shellCwd = process.cwd()) {
  const output = await runCli(argv, shellCwd);
  if (output) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  }
}

export async function runCli(argv: string[], shellCwd: string): Promise<string> {
  const invocation = parseCliArgs(argv, shellCwd);
  if (invocation.kind === "help") {
    return commandHelp[invocation.topic];
  }

  switch (invocation.command) {
    case "scan":
      return runScan(invocation.parsed);
    case "fix":
      return runFix(invocation.parsed);
    case "init":
      return runInit(invocation.parsed.cwd);
    case "doctor":
      return runDoctor(invocation.parsed.cwd);
    case "skill-install":
      return runSkillInstall(invocation.parsed.cwd);
  }
}

export function parseCliArgs(argv: string[], shellCwd: string): CliInvocation {
  const args = [...argv];
  let cwd = shellCwd;

  while (args.length > 0 && args[0].startsWith("-")) {
    const arg = args.shift()!;
    if (isHelpFlag(arg)) {
      return { kind: "help", topic: "root" };
    }
    if (arg === "--cwd") {
      cwd = resolveCliCwd(shellCwd, takeFlagValue(args, arg, "wayweft"));
      continue;
    }
    throw new Error(`Unknown flag: ${arg}. Run \`wayweft --help\` for supported usage.`);
  }

  if (args.length === 0) {
    return {
      kind: "command",
      command: "scan",
      parsed: { cwd, format: "text" },
    };
  }

  const command = args.shift()!;
  if (command === "help") {
    return { kind: "help", topic: parseHelpTopic(args) };
  }

  switch (command) {
    case "scan":
    case "report": {
      if (args.some(isHelpFlag)) {
        return { kind: "help", topic: "scan" };
      }
      const parsed = parseCommandArgs(args, command, cwd, shellCwd, {
        format: "text",
        valueFlags: {
          "--cwd": "cwd",
          "--scope": "scope",
          "--format": "format",
          "--output": "output",
          "--since": "since",
          "--max-findings": "maxFindings",
          "--min-score": "minScore",
          "--rule": "rule",
        },
        booleanFlags: {
          "--changed-only": "changedOnly",
        },
      });
      return { kind: "command", command: "scan", parsed };
    }
    case "fix": {
      if (args.some(isHelpFlag)) {
        return { kind: "help", topic: "fix" };
      }
      const parsed = parseCommandArgs(args, "fix", cwd, shellCwd, {
        format: "text",
        valueFlags: {
          "--cwd": "cwd",
          "--scope": "scope",
          "--since": "since",
          "--min-score": "minScore",
          "--rule": "rule",
        },
        booleanFlags: {
          "--apply": "apply",
          "--dry-run": "dryRun",
        },
      });
      return { kind: "command", command: "fix", parsed };
    }
    case "doctor": {
      if (args.some(isHelpFlag)) {
        return { kind: "help", topic: "doctor" };
      }
      const parsed = parseCommandArgs(args, "doctor", cwd, shellCwd, {
        format: "text",
        valueFlags: {
          "--cwd": "cwd",
        },
        booleanFlags: {},
      });
      return { kind: "command", command: "doctor", parsed };
    }
    case "init": {
      if (args.some(isHelpFlag)) {
        return { kind: "help", topic: "init" };
      }
      const parsed = parseCommandArgs(args, "init", cwd, shellCwd, {
        format: "text",
        valueFlags: {
          "--cwd": "cwd",
        },
        booleanFlags: {},
      });
      return { kind: "command", command: "init", parsed };
    }
    case "skill": {
      const subcommand = args.shift();
      if (subcommand === undefined) {
        throw new Error("Missing skill subcommand. Run `wayweft skill install --help` for supported usage.");
      }
      if (isHelpFlag(subcommand)) {
        return { kind: "help", topic: "skill-install" };
      }
      if (subcommand !== "install") {
        throw new Error(
          `Unsupported skill subcommand: ${subcommand}. Run \`wayweft skill install --help\` for supported usage.`,
        );
      }
      if (args.some(isHelpFlag)) {
        return { kind: "help", topic: "skill-install" };
      }

      const parsed = parseCommandArgs(args, "skill install", cwd, shellCwd, {
        format: "text",
        valueFlags: {
          "--cwd": "cwd",
        },
        booleanFlags: {},
      });
      return { kind: "command", command: "skill-install", parsed };
    }
    default:
      throw new Error(`Unknown command: ${command}. Run \`wayweft --help\` for supported commands.`);
  }
}

async function runScan(parsed: ParsedArgs): Promise<string> {
  const result = await scanWorkspace({
    cwd: parsed.cwd,
    target: parseScope(parsed.scope, parsed.since),
    changedOnly: parsed.changedOnly,
    since: parsed.since,
    maxFindings: parsed.maxFindings,
    minScore: parsed.minScore,
    rule: parsed.rule,
  });

  const rendered = formatResult(result, parsed.format);
  if (parsed.output) {
    mkdirSync(path.dirname(parsed.output), { recursive: true });
    writeFileSync(parsed.output, rendered, "utf8");
    return "";
  }

  return rendered;
}

async function runFix(parsed: ParsedArgs): Promise<string> {
  const result = await scanWorkspace({
    cwd: parsed.cwd,
    target: parseScope(parsed.scope, parsed.since),
    since: parsed.since,
    minScore: parsed.minScore,
    rule: parsed.rule,
  });
  const selected = parsed.rule
    ? result.findings.filter((finding) => finding.ruleId === parsed.rule)
    : result.findings;
  const fixResult = applySafeFixes(selected, Boolean(parsed.apply && !parsed.dryRun));
  return fixResult.preview;
}

function runInit(cwd: string): string {
  const configPath = path.join(cwd, "wayweft.config.ts");
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      `import { defaultIgnorePatterns, defineConfig } from "wayweft";

export default defineConfig({
  workspace: {
    rootMarkers: ["pnpm-workspace.yaml", "turbo.json", "nx.json", "package.json", ".git"],
    packageGlobs: ["apps/*", "packages/*", "services/*"],
  },
  analysis: {
    minScore: 25,
    changedOnlyDefault: false,
    includeGitChurn: true,
  },
  rules: {
    "long-function": { maxLines: 45 },
    "deep-nesting": { maxDepth: 3 },
    "too-many-params": { maxParams: 4 },
    "boolean-param": { enabled: true },
    "cross-package-duplication": { enabled: true },
  },
  ignore: [...defaultIgnorePatterns],
});
`,
      "utf8",
    );
  }
  installSkillBundles({ rootDir: cwd });
  return "Initialized Wayweft config and skill bundles.";
}

async function runSkillInstall(cwd: string): Promise<string> {
  const result = await scanWorkspace({
    cwd,
    target: { scope: "workspace" },
  });
  const written = installSkillBundles({
    rootDir: result.workspace.rootDir,
    packageDirs: result.workspace.packages.map((pkg) => pkg.dir),
  });
  return `Installed skill bundles:\n${written.map((item) => `- ${item}`).join("\n")}`;
}

async function runDoctor(cwd: string): Promise<string> {
  const configPath = findConfigPath(cwd);
  const config = await loadConfig(cwd);
  const workspace = await discoverWorkspace(cwd, config, { scope: "workspace" });
  const packageLines = workspace.packages.map((pkg) => {
    const relativeDir = normalizePath(path.relative(workspace.rootDir, pkg.dir)) || ".";
    const tsconfigLabel = pkg.tsconfigPath ? "tsconfig" : "no tsconfig";
    return `  - ${pkg.name} (${relativeDir}, ${tsconfigLabel})`;
  });
  const ignoreSource = configPath ? "from config" : "built-in defaults";
  const skillPaths = [
    path.join(workspace.rootDir, "tools", "wayweft-skill", "SKILL.md"),
    path.join(workspace.rootDir, ".agents", "skills", "wayweft", "SKILL.md"),
    path.join(workspace.rootDir, ".claude", "skills", "wayweft", "SKILL.md"),
  ];
  const installedSkillBundles = skillPaths.filter((skillPath) => existsSync(skillPath)).length;
  const packageDirs = workspace.packages.filter((pkg) => path.resolve(pkg.dir) !== path.resolve(workspace.rootDir));
  const packageSkillBundles = packageDirs.filter((pkg) =>
    existsSync(path.join(pkg.dir, ".agents", "skills", "wayweft", "SKILL.md")) &&
    existsSync(path.join(pkg.dir, ".claude", "skills", "wayweft", "SKILL.md")),
  ).length;

  return [
    `Workspace root: ${workspace.rootDir}`,
    `Config: ${configPath ?? "not found (using built-in defaults)"}`,
    `Discovery markers: ${config.workspace.rootMarkers.join(", ")}`,
    `Package globs: ${config.workspace.packageGlobs.join(", ")}`,
    `Packages discovered: ${workspace.packages.length}`,
    ...(packageLines.length > 0 ? packageLines : ["  - none"]),
    `Tsconfig files: ${workspace.tsconfigGraph.size}`,
    `Files in scan inventory: ${workspace.fileInventory.length}`,
    `Ignore patterns (${ignoreSource}):`,
    ...config.ignore.map((pattern) => `  - ${pattern}`),
    "Skill bundles:",
    `  - root bundle files: ${installedSkillBundles}/3 installed`,
    `  - package-local bundles: ${packageSkillBundles}/${packageDirs.length} packages`,
    "Doctor checks: ok",
  ].join("\n");
}

function findConfigPath(cwd: string): string | undefined {
  return ["wayweft.config.ts", "wayweft.config.js", "wayweft.config.json"]
    .map((candidate) => path.join(cwd, candidate))
    .find((candidate) => existsSync(candidate));
}

function formatResult(result: Awaited<ReturnType<typeof scanWorkspace>>, format: Format): string {
  switch (format) {
    case "json":
      return formatJsonReport(result);
    case "markdown":
      return formatMarkdownReport(result);
    case "sarif":
      return formatSarifReport(result);
    default:
      return formatTextReport(result);
  }
}

function parseHelpTopic(args: string[]): HelpTopic {
  const [command, subcommand] = args;
  if (!command) {
    return "root";
  }
  if (command === "scan" || command === "report") {
    return "scan";
  }
  if (command === "fix") {
    return "fix";
  }
  if (command === "doctor") {
    return "doctor";
  }
  if (command === "init") {
    return "init";
  }
  if (command === "skill" && subcommand === "install") {
    return "skill-install";
  }
  throw new Error(`Unknown help topic: ${[command, subcommand].filter(Boolean).join(" ")}. Run \`wayweft --help\`.`);
}

function parseCommandArgs(
  args: string[],
  commandLabel: string,
  defaultCwd: string,
  shellCwd: string,
  options: {
    format: Format;
    valueFlags: Record<string, keyof ParsedArgs>;
    booleanFlags: Record<string, keyof ParsedArgs>;
  },
): ParsedArgs {
  const parsed: ParsedArgs = {
    cwd: defaultCwd,
    format: options.format,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      throw new Error(`Unsupported argument: ${arg}. Run \`wayweft ${commandLabel} --help\` for usage.`);
    }

    if (arg in options.valueFlags) {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Flag ${arg} requires a value. Run \`wayweft ${commandLabel} --help\` for usage.`);
      }

      const key = options.valueFlags[arg];
      if (key === "cwd") {
        parsed.cwd = resolveCliCwd(shellCwd, value);
      } else if (key === "minScore" || key === "maxFindings") {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) {
          throw new Error(`Flag ${arg} requires a number. Run \`wayweft ${commandLabel} --help\` for usage.`);
        }
        parsed[key] = numericValue;
      } else if (key === "format") {
        parsed.format = parseFormat(value, commandLabel);
      } else if (key === "output") {
        parsed.output = path.resolve(shellCwd, value);
      } else if (key === "scope") {
        parsed.scope = value;
      } else if (key === "since") {
        parsed.since = value;
      } else if (key === "rule") {
        parsed.rule = value;
      } else {
        throw new Error(`Unexpected value flag mapping: ${String(key)}`);
      }
      index += 1;
      continue;
    }

    if (arg in options.booleanFlags) {
      const key = options.booleanFlags[arg];
      if (key === "changedOnly") {
        parsed.changedOnly = true;
      } else if (key === "apply") {
        parsed.apply = true;
      } else if (key === "dryRun") {
        parsed.dryRun = true;
      } else {
        throw new Error(`Unexpected boolean flag mapping: ${String(key)}`);
      }
      continue;
    }

    throw new Error(`Unknown flag: ${arg}. Run \`wayweft ${commandLabel} --help\` for usage.`);
  }

  return parsed;
}

function parseFormat(value: string, commandLabel: string): Format {
  if (value === "text" || value === "json" || value === "sarif" || value === "markdown") {
    return value;
  }
  throw new Error(
    `Unsupported format: ${value}. Use text, json, markdown, or sarif. Run \`wayweft ${commandLabel} --help\`.`,
  );
}

function parseScope(scopeValue?: string, since?: string) {
  if (!scopeValue || scopeValue === "workspace") {
    return { scope: "workspace" as const };
  }
  if (scopeValue.startsWith("package:")) {
    return { scope: "package" as const, value: scopeValue.slice("package:".length) };
  }
  if (scopeValue.startsWith("path:")) {
    return { scope: "path" as const, value: scopeValue.slice("path:".length) };
  }
  if (scopeValue === "changed") {
    return { scope: "changed" as const, value: since };
  }
  if (scopeValue.startsWith("since:")) {
    return { scope: "since" as const, value: scopeValue.slice("since:".length) };
  }
  return { scope: "workspace" as const };
}

function resolveCliCwd(shellCwd: string, value: string): string {
  return path.resolve(shellCwd, value);
}

function takeFlagValue(args: string[], flag: string, commandLabel: string): string {
  const value = args.shift();
  if (!value || value.startsWith("-")) {
    throw new Error(`Flag ${flag} requires a value. Run \`wayweft ${commandLabel} --help\` for usage.`);
  }
  return value;
}

function isHelpFlag(arg: string) {
  return arg === "--help" || arg === "-h";
}

function isDirectExecution() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
