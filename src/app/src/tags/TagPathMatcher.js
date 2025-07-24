/**
 * Utility function to match tags by path
 * @param {Array} allTags - Array of all tags
 * @param {string} tagPath - The tag path to match
 * @returns {Array} - Array of matching tags
 */
export function getMatchingTags(allTags, tagPath) {
  // Handle edge cases
  if (!allTags || !Array.isArray(allTags) || !tagPath || typeof tagPath !== 'string') {
    return [];
  }

  return allTags.filter(tag => {
    // Ensure tag has fullPath property
    if (!tag || !tag.fullPath) {
      return false;
    }

    // Exact match or is a child tag (starts with the path + '/' to avoid partial matches)
    return tag.fullPath === tagPath ||
           (tag.fullPath.startsWith(tagPath + '/') &&
            // Ensure we're not matching partial tag names (e.g., "ai" shouldn't match "aide")
            (tagPath + '/').length <= tag.fullPath.length);
  });
}
