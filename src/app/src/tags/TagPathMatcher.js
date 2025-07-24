/**
 * Utility function to match tags by path
 * @param {Array} allTags - Array of all tags
 * @param {string} tagPath - The tag path to match
 * @returns {Array} - Array of matching tags
 */
export function getMatchingTags(allTags, tagPath) {
  return allTags.filter(tag => {
    // Exact match or is a child tag (starts with the path + '/' to avoid partial matches)
    return tag.fullPath === tagPath ||
           (tag.fullPath.startsWith(tagPath + '/') &&
            // Ensure we're not matching partial tag names (e.g., "ai" shouldn't match "aide")
            (tagPath + '/').length <= tag.fullPath.length);
  });
}