import path from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { defaultIgnorePatterns, loadConfig, normalizeConfig } from "../src/config";

const tempDirs: string[] = [];

describe("loadConfig", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("loads a ts config that uses a relative import", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "wayweft-config-"));
    tempDirs.push(rootDir);
    mkdirSync(path.join(rootDir, "src"), { recursive: true });

    writeFileSync(
      path.join(rootDir, "src", "helpers.js"),
      'export function makeIgnore() { return ["**/custom-generated/**"]; }\n',
      "utf8",
    );
    writeFileSync(
      path.join(rootDir, "wayweft.config.ts"),
      [
        'import { makeIgnore } from "./src/helpers.js";',
        "",
        "export default {",
        "  analysis: { minScore: 5 },",
        "  ignore: makeIgnore(),",
        "};",
        "",
      ].join("\n"),
      "utf8",
    );

    const config = await loadConfig(rootDir);

    expect(config.analysis.minScore).toBe(5);
    expect(config.ignore).toContain("**/custom-generated/**");
  });

  it("allows config to extend the built-in ignore defaults", () => {
    const config = normalizeConfig({
      ignore: [...defaultIgnorePatterns, "**/custom-generated/**"],
    });

    expect(config.ignore).toContain("**/dist/**");
    expect(config.ignore).toContain("**/*.min.js");
    expect(config.ignore).toContain("**/custom-generated/**");
  });
});
