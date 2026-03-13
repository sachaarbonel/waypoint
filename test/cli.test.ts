import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(testDir, "fixtures", "monorepo");

describe("cli", () => {
  it("resolves --cwd for scan commands", () => {
    const parsed = parseCliArgs(["scan", "--cwd", "./test/fixtures/monorepo", "--scope", "workspace"], process.cwd());

    expect(parsed.kind).toBe("command");
    expect(parsed.kind === "command" ? parsed.parsed.cwd : "").toBe(fixtureRoot);
    expect(parsed.kind === "command" ? parsed.command : "").toBe("scan");
  });

  it("prints root help output", async () => {
    const output = await runCli(["--help"], process.cwd());

    expect(output).toContain("Usage: wayweft <command> [options]");
    expect(output).toContain("skill install");
    expect(output).toContain("--cwd <path>");
  });

  it("runs scans against an explicit cwd", async () => {
    const output = await runCli(
      ["scan", "--cwd", "./test/fixtures/monorepo", "--scope", "workspace", "--format", "json", "--min-score", "0"],
      process.cwd(),
    );

    expect(output).toContain("\"rootDir\"");
    expect(output).toContain("fixture-monorepo");
    expect(output).toContain("too-many-params");
  });

  it("returns actionable errors for unsupported flags", () => {
    expect(() => parseCliArgs(["scan", "--bogus"], process.cwd())).toThrow(
      "Unknown flag: --bogus. Run `wayweft scan --help` for usage.",
    );
  });
});
