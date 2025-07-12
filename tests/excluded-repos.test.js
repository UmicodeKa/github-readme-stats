import { jest } from "@jest/globals";
import { expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import {
  getExclusionConditionsFromEnv,
  getExactReposFromEnv,
  getPatternReposFromEnv,
  isRepoExcludedByInternalRules,
  getCombinedExcludedRepos,
} from "../src/common/excluded-repos.js";

describe("excluded-repos", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("parseQuotedCommaSeparated", () => {
    it("should return empty array when no environment variable is set", () => {
      delete process.env.EXCLUDE_EXACT;
      expect(getExactReposFromEnv()).toEqual([]);
    });

    it("should parse single-quoted comma-separated repository names", () => {
      process.env.EXCLUDE_EXACT = "'repo1','repo2','repo3'";
      expect(getExactReposFromEnv()).toEqual(["repo1", "repo2", "repo3"]);
    });

    it("should handle empty values between quotes", () => {
      process.env.EXCLUDE_EXACT = "'repo1','','repo3'";
      expect(getExactReposFromEnv()).toEqual(["repo1", "", "repo3"]);
    });

    it("should handle spaces in repository names", () => {
      process.env.EXCLUDE_EXACT = "'repo with spaces','another-repo'";
      expect(getExactReposFromEnv()).toEqual(["repo with spaces", "another-repo"]);
    });
  });

  describe("parseRegexPatterns", () => {
    it("should return empty array when EXCLUDE_PATTERNS is not set", () => {
      delete process.env.EXCLUDE_PATTERNS;
      expect(getPatternReposFromEnv()).toEqual([]);
    });

    it("should parse single-quoted regex patterns", () => {
      process.env.EXCLUDE_PATTERNS = "'/^test_/','/^dev_/'";
      const patterns = getPatternReposFromEnv();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].test("test_repo")).toBe(true);
      expect(patterns[1].test("dev_branch")).toBe(true);
    });

    it("should handle patterns with and without slashes", () => {
      process.env.EXCLUDE_PATTERNS = "'/^test_/','.*-backup$'";
      const patterns = getPatternReposFromEnv();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].test("test_repo")).toBe(true);
      expect(patterns[1].test("project-backup")).toBe(true);
    });

    it("should handle invalid regex patterns gracefully", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      process.env.EXCLUDE_PATTERNS = "'/^test_/','[invalid'";
      const patterns = getPatternReposFromEnv();
      expect(patterns).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("parseBoolean", () => {
    it("should return false when environment variables are not set", () => {
      delete process.env.EXCLUDE_ARCHIVED;
      delete process.env.EXCLUDE_FORK;
      delete process.env.EXCLUDE_PRIVATE;
      
      const conditions = getExclusionConditionsFromEnv();
      expect(conditions.archived).toBe(false);
      expect(conditions.fork).toBe(false);
      expect(conditions.private).toBe(false);
    });

    it("should parse boolean values correctly", () => {
      process.env.EXCLUDE_ARCHIVED = "true";
      process.env.EXCLUDE_FORK = "false";
      process.env.EXCLUDE_PRIVATE = "TRUE";
      
      const conditions = getExclusionConditionsFromEnv();
      expect(conditions.archived).toBe(true);
      expect(conditions.fork).toBe(false);
      expect(conditions.private).toBe(true);
    });

    it("should handle invalid boolean values", () => {
      process.env.EXCLUDE_ARCHIVED = "invalid";
      process.env.EXCLUDE_FORK = "";
      
      const conditions = getExclusionConditionsFromEnv();
      expect(conditions.archived).toBe(false);
      expect(conditions.fork).toBe(false);
    });
  });

  describe("isRepoExcludedByInternalRules", () => {
    it("should not exclude repositories by default", () => {
      const repo = { name: "test-repo" };
      expect(isRepoExcludedByInternalRules(repo)).toBe(false);
    });

    it("should exclude repositories by exact match from environment", () => {
      process.env.EXCLUDE_EXACT = "'test-repo','old-project'";
      expect(isRepoExcludedByInternalRules({ name: "test-repo" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "old-project" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "other-repo" })).toBe(false);
    });

    it("should exclude repositories by pattern match from environment", () => {
      process.env.EXCLUDE_PATTERNS = "'/^temp_/','.*-old$'";
      expect(isRepoExcludedByInternalRules({ name: "temp_file" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "project-old" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "normal-repo" })).toBe(false);
    });

    it("should exclude archived repositories when configured", () => {
      process.env.EXCLUDE_ARCHIVED = "true";
      expect(isRepoExcludedByInternalRules({ name: "repo", isArchived: true })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "repo", isArchived: false })).toBe(false);
    });

    it("should exclude fork repositories when configured", () => {
      process.env.EXCLUDE_FORK = "true";
      expect(isRepoExcludedByInternalRules({ name: "repo", isFork: true })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "repo", isFork: false })).toBe(false);
    });

    it("should exclude private repositories when configured", () => {
      process.env.EXCLUDE_PRIVATE = "true";
      expect(isRepoExcludedByInternalRules({ name: "repo", isPrivate: true })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "repo", isPrivate: false })).toBe(false);
    });

    it("should combine multiple exclusion rules", () => {
      process.env.EXCLUDE_ARCHIVED = "true";
      process.env.EXCLUDE_EXACT = "'specific-repo'";
      process.env.EXCLUDE_PATTERNS = "'/^test_/'";
      
      expect(isRepoExcludedByInternalRules({ name: "archived-repo", isArchived: true })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "specific-repo" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "test_something" })).toBe(true);
      expect(isRepoExcludedByInternalRules({ name: "normal-repo" })).toBe(false);
    });
  });

  describe("getCombinedExcludedRepos", () => {
    it("should combine URL exclusions with environment variables", () => {
      process.env.EXCLUDE_EXACT = "'env-repo1','env-repo2'";
      const urlExclusions = ["url-repo1"];
      const combined = getCombinedExcludedRepos(urlExclusions);
      
      expect(combined.has("env-repo1")).toBe(true);
      expect(combined.has("env-repo2")).toBe(true);
      expect(combined.has("url-repo1")).toBe(true);
      expect(combined.size).toBe(3);
    });

    it("should handle duplicates correctly", () => {
      process.env.EXCLUDE_EXACT = "'duplicate-repo'";
      const urlExclusions = ["duplicate-repo"];
      const combined = getCombinedExcludedRepos(urlExclusions);
      
      expect(combined.has("duplicate-repo")).toBe(true);
      expect(combined.size).toBe(1);
    });

    it("should work with empty environment variables", () => {
      delete process.env.EXCLUDE_EXACT;
      const urlExclusions = ["url-repo"];
      const combined = getCombinedExcludedRepos(urlExclusions);
      
      expect(combined.has("url-repo")).toBe(true);
      expect(combined.size).toBe(1);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complex Vercel environment variable setup", () => {
      // Simulate actual Vercel environment variables
      process.env.EXCLUDE_ARCHIVED = "true";
      process.env.EXCLUDE_FORK = "true";
      process.env.EXCLUDE_PRIVATE = "false";
      process.env.EXCLUDE_EXACT = "'secret-project','internal-tool'";
      process.env.EXCLUDE_PATTERNS = "'/^le_/','/^ITL_/','/^nightroom2-front_/'";
      
      // Test various repository scenarios
      expect(isRepoExcludedByInternalRules({ 
        name: "le_project", 
        isArchived: false, 
        isFork: false 
      })).toBe(true);
      
      expect(isRepoExcludedByInternalRules({ 
        name: "ITL_backend", 
        isArchived: false, 
        isFork: false 
      })).toBe(true);
      
      expect(isRepoExcludedByInternalRules({ 
        name: "nightroom2-front_main", 
        isArchived: false, 
        isFork: false 
      })).toBe(true);
      
      expect(isRepoExcludedByInternalRules({ 
        name: "normal-repo", 
        isArchived: true, 
        isFork: false 
      })).toBe(true); // excluded because archived
      
      expect(isRepoExcludedByInternalRules({ 
        name: "fork-repo", 
        isArchived: false, 
        isFork: true 
      })).toBe(true); // excluded because fork
      
      expect(isRepoExcludedByInternalRules({ 
        name: "secret-project", 
        isArchived: false, 
        isFork: false 
      })).toBe(true); // excluded by exact match
      
      expect(isRepoExcludedByInternalRules({ 
        name: "public-project", 
        isArchived: false, 
        isFork: false, 
        isPrivate: false 
      })).toBe(false); // should not be excluded
    });
  });
});