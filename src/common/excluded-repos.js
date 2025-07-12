// @ts-check
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Parse single-quoted comma-separated values
 * Example: "'value1','value2','value3'" -> ['value1', 'value2', 'value3']
 *
 * @param {string} str The input string to parse
 * @returns {string[]} Array of parsed values
 */
const parseQuotedCommaSeparated = (str) => {
  if (!str || str.trim() === "") {return [];}

  const regex = /'([^']*)'/g;
  const matches = [];
  let match;

  while ((match = regex.exec(str)) !== null) {
    matches.push(match[1]);
  }

  return matches;
};

/**
 * Parse regex patterns from quoted comma-separated string
 * Example: "'/^test_/','/^dev_/'" -> [/^test_/, /^dev_/]
 *
 * @param {string} str The input string to parse
 * @returns {RegExp[]} Array of regex patterns
 */
const parseRegexPatterns = (str) => {
  const quotedValues = parseQuotedCommaSeparated(str);
  return quotedValues
    .map((pattern) => {
      // Remove leading/trailing slashes if present
      const cleanPattern = pattern.replace(/^\/|\/$/g, "");
      try {
        return new RegExp(cleanPattern);
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`, e);
        return null;
      }
    })
    .filter((pattern) => pattern !== null);
};

/**
 * Parse boolean value from environment variable
 *
 * @param {string} str The input string to parse
 * @param {boolean} defaultValue Default value if parsing fails
 * @returns {boolean} Parsed boolean value
 */
const parseBoolean = (str, defaultValue = false) => {
  if (!str) {return defaultValue;}
  return str.toLowerCase() === "true";
};

/**
 * Get exclusion conditions from environment variables
 *
 * @returns {object} Object containing exclusion conditions
 */
export const getExclusionConditionsFromEnv = () => {
  return {
    archived: parseBoolean(process.env.EXCLUDE_ARCHIVED),
    fork: parseBoolean(process.env.EXCLUDE_FORK),
    private: parseBoolean(process.env.EXCLUDE_PRIVATE),
  };
};

/**
 * Get exact repository names from environment variable
 *
 * @returns {string[]} Array of repository names to exclude
 */
export const getExactReposFromEnv = () => {
  const exactRepos = process.env.EXCLUDE_EXACT || "";
  return parseQuotedCommaSeparated(exactRepos);
};

/**
 * Get regex patterns from environment variable
 *
 * @returns {RegExp[]} Array of regex patterns for repositories to exclude
 */
export const getPatternReposFromEnv = () => {
  const patterns = process.env.EXCLUDE_PATTERNS || "";
  return parseRegexPatterns(patterns);
};

/**
 * Check if a repository should be excluded based on internal rules.
 *
 * @param {object} repo Repository object.
 * @param {string} repo.name Repository name.
 * @param {boolean} [repo.isArchived] Whether the repository is archived.
 * @param {boolean} [repo.isFork] Whether the repository is a fork.
 * @param {boolean} [repo.isPrivate] Whether the repository is private.
 * @returns {boolean} True if the repository should be excluded.
 */
export const isRepoExcludedByInternalRules = (repo) => {
  // 1. Check environment variable conditions
  const envConditions = getExclusionConditionsFromEnv();
  if (envConditions.archived && repo.isArchived) {return true;}
  if (envConditions.fork && repo.isFork) {return true;}
  if (envConditions.private && repo.isPrivate) {return true;}

  // 2. Check environment variable exact matches
  const envExactRepos = getExactReposFromEnv();
  if (envExactRepos.includes(repo.name)) {return true;}

  // 3. Check environment variable patterns
  const envPatterns = getPatternReposFromEnv();
  for (const pattern of envPatterns) {
    if (pattern.test(repo.name)) {return true;}
  }

  return false;
};

/**
 * Get all excluded repository names from both URL parameters and environment variables.
 *
 * @param {string[]} urlExcludedRepos Repository names excluded via URL parameters.
 * @returns {Set<string>} Combined set of excluded repository names.
 */
export const getCombinedExcludedRepos = (urlExcludedRepos = []) => {
  const excludedSet = new Set(urlExcludedRepos);

  // Add exact matches from environment variables only
  getExactReposFromEnv().forEach((repo) => excludedSet.add(repo));

  return excludedSet;
};
