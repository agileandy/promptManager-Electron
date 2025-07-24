import { getMatchingTags } from './TagPathMatcher.js';

describe('TagPathMatcher', () => {
  let allTags;

  beforeEach(() => {
    // Set up test data
    allTags = [
      { id: 1, name: 'ai', fullPath: 'ai', parentId: null, level: 0 },
      { id: 2, name: 'ml', fullPath: 'ai/ml', parentId: 1, level: 1 },
      { id: 3, name: 'nlp', fullPath: 'ai/nlp', parentId: 1, level: 1 },
      { id: 4, name: 'web', fullPath: 'web', parentId: null, level: 0 },
      { id: 5, name: 'frontend', fullPath: 'web/frontend', parentId: 4, level: 1 },
      { id: 6, name: 'backend', fullPath: 'web/backend', parentId: 4, level: 1 },
      { id: 7, name: 'aide', fullPath: 'aide', parentId: null, level: 0 }, // Similar but different tag
      { id: 8, name: 'ai-dev', fullPath: 'ai-dev', parentId: null, level: 0 } // Special characters
    ];
  });

  test('should match exact tag path and its children', () => {
    const matchingTags = getMatchingTags(allTags, 'ai');
    expect(matchingTags).toHaveLength(3);
    const tagPaths = matchingTags.map(t => t.fullPath);
    expect(tagPaths).toContain('ai');
    expect(tagPaths).toContain('ai/ml');
    expect(tagPaths).toContain('ai/nlp');
  });

  test('should match parent tag and all its children', () => {
    const matchingTags = getMatchingTags(allTags, 'ai');
    expect(matchingTags).toHaveLength(3);
    expect(matchingTags.map(t => t.fullPath)).toEqual(['ai', 'ai/ml', 'ai/nlp']);
  });

  test('should not match partial tag names', () => {
    const matchingTags = getMatchingTags(allTags, 'ai');
    const tagPaths = matchingTags.map(t => t.fullPath);
    expect(tagPaths).not.toContain('aide');
  });

  test('should handle non-existent tag path', () => {
    const matchingTags = getMatchingTags(allTags, 'nonexistent');
    expect(matchingTags).toHaveLength(0);
  });

  test('should properly handle tag with special characters', () => {
    const matchingTags = getMatchingTags(allTags, 'ai-dev');
    expect(matchingTags).toHaveLength(1);
    expect(matchingTags[0].fullPath).toBe('ai-dev');
  });

  test('should match deeply nested tags', () => {
    // Add a deeply nested tag
    const extendedTags = [
      ...allTags,
      { id: 9, name: 'research', fullPath: 'ai/ml/research', parentId: 2, level: 2 },
      { id: 10, name: 'models', fullPath: 'ai/ml/research/models', parentId: 9, level: 3 }
    ];

    const matchingTags = getMatchingTags(extendedTags, 'ai');
    expect(matchingTags).toHaveLength(5);
    const tagPaths = matchingTags.map(t => t.fullPath);
    expect(tagPaths).toContain('ai');
    expect(tagPaths).toContain('ai/ml');
    expect(tagPaths).toContain('ai/nlp');
    expect(tagPaths).toContain('ai/ml/research');
    expect(tagPaths).toContain('ai/ml/research/models');
  });
});