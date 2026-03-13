import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(testDir, "fixtures", "monorepo");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

  it("prints doctor details for a configured workspace with installed skills", async () => {
    const repoDir = await createDoctorWorkspace({ withConfig: true, withSkills: true });

    const output = await runCli(["doctor", "--cwd", repoDir], process.cwd());

    expect(output).toContain(`Workspace root: ${repoDir}`);
    expect(output).toContain(`Config: ${path.join(repoDir, "wayweft.config.json")}`);
    expect(output).toContain("Packages discovered: 2");
    expect(output).toContain("  - doctor-fixture (., tsconfig)");
    expect(output).toContain("  - pkg-a (packages/pkg-a, tsconfig)");
    expect(output).toContain("Tsconfig files: 2");
    expect(output).toContain("Ignore patterns (from config):");
    expect(output).toContain("  - **/custom-generated/**");
    expect(output).toContain("  - root bundle files: 3/3 installed");
    expect(output).toContain("  - package-local bundles: 1/1 packages");
  });

  it("prints doctor defaults when config and skills are missing", async () => {
    const repoDir = await createDoctorWorkspace({ withConfig: false, withSkills: false });

    const output = await runCli(["doctor", "--cwd", repoDir], process.cwd());

    expect(output).toContain("Config: not found (using built-in defaults)");
    expect(output).toContain("Ignore patterns (built-in defaults):");
    expect(output).toContain("  - **/node_modules/**");
    expect(output).toContain("  - root bundle files: 0/3 installed");
    expect(output).toContain("  - package-local bundles: 0/1 packages");
    expect(output).toContain("Doctor checks: ok");
  });
});

async function createDoctorWorkspace(options: { withConfig: boolean; withSkills: boolean }): Promise<string> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "wayweft-doctor-"));
  tempDirs.push(repoDir);

  await writeJson(path.join(repoDir, "package.json"), {
    name: "doctor-fixture",
    private: true,
    workspaces: ["packages/*"],
  });
  await writeJson(path.join(repoDir, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
    },
  });
  await writeFile(path.join(repoDir, "index.ts"), "export const rootValue = 1;\n", "utf8");

  const packageDir = path.join(repoDir, "packages", "pkg-a");
  await mkdir(path.join(packageDir, "src"), { recursive: true });
  await writeJson(path.join(packageDir, "package.json"), {
    name: "pkg-a",
    version: "1.0.0",
  });
  await writeJson(path.join(packageDir, "tsconfig.json"), {
    extends: "../../tsconfig.json",
  });
  await writeFile(path.join(packageDir, "src", "index.ts"), "export const packageValue = 2;\n", "utf8");

  if (options.withConfig) {
    await writeJson(path.join(repoDir, "wayweft.config.json"), {
      ignore: ["**/custom-generated/**"],
      workspace: {
        packageGlobs: ["packages/*"],
      },
    });
  }

  if (options.withSkills) {
    await writeText(path.join(repoDir, "tools", "wayweft-skill", "SKILL.md"), "# skill\n");
    await writeText(path.join(repoDir, ".agents", "skills", "wayweft", "SKILL.md"), "# skill\n");
    await writeText(path.join(repoDir, ".claude", "skills", "wayweft", "SKILL.md"), "# skill\n");
    await writeText(path.join(packageDir, ".agents", "skills", "wayweft", "SKILL.md"), "# skill\n");
    await writeText(path.join(packageDir, ".claude", "skills", "wayweft", "SKILL.md"), "# skill\n");
  }

  return repoDir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}
