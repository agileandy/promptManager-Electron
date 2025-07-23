// Test script to verify tag hierarchy parsing
// This should be run in the browser console to test the tag creation logic

async function testTagHierarchy() {
    console.log("Testing tag hierarchy parsing...");

    // Test case 1: Simple nested tag "coding/initialise"
    console.log("\n=== Test 1: Creating nested tag 'coding/initialise' ===");

    // Clear any existing tags for clean test
    await db.tags.clear();
    await db.promptTags.clear();

    // Create the hierarchical tag
    const result = await createOrGetTag("coding/initialise");
    console.log("Created tag:", result);

    // Verify the hierarchy was created correctly
    const allTags = await db.tags.toArray();
    console.log("All tags in database:", allTags);

    // Check that we have two tags: "coding" (parent) and "coding/initialise" (child)
    const parentTag = allTags.find(t => t.fullPath === "coding");
    const childTag = allTags.find(t => t.fullPath === "coding/initialise");

    console.log("Parent tag (coding):", parentTag);
    console.log("Child tag (coding/initialise):", childTag);

    // Assertions
    if (!parentTag) {
        console.error("❌ FAIL: Parent tag 'coding' was not created");
        return false;
    }

    if (!childTag) {
        console.error("❌ FAIL: Child tag 'coding/initialise' was not created");
        return false;
    }

    if (parentTag.parentId !== null) {
        console.error("❌ FAIL: Parent tag should have parentId = null, got:", parentTag.parentId);
        return false;
    }

    if (childTag.parentId !== parentTag.id) {
        console.error("❌ FAIL: Child tag should have parentId =", parentTag.id, "got:", childTag.parentId);
        return false;
    }

    if (parentTag.level !== 0) {
        console.error("❌ FAIL: Parent tag should have level = 0, got:", parentTag.level);
        return false;
    }

    if (childTag.level !== 1) {
        console.error("❌ FAIL: Child tag should have level = 1, got:", childTag.level);
        return false;
    }

    console.log("✅ SUCCESS: Tag hierarchy created correctly");

    // Test the rendering
    console.log("\n=== Test 2: Verifying tag tree rendering ===");
    await renderTagTree();

    // Check if the tags appear in the correct hierarchy in the DOM
    const tagTree = document.getElementById('tag-tree');
    const tagElements = tagTree.querySelectorAll('[data-tag-path]');

    console.log("Tags found in rendered tree:");
    tagElements.forEach(el => {
        const path = el.getAttribute('data-tag-path');
        const level = el.closest('li').style.marginLeft || '0px';
        console.log(`  - ${path} (margin: ${level})`);
    });

    return true;
}

// Run the test
testTagHierarchy().then(success => {
    if (success) {
        console.log("\n🎉 All tests passed!");
    } else {
        console.log("\n💥 Tests failed!");
    }
}).catch(error => {
    console.error("Test execution failed:", error);
});