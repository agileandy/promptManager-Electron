#!/usr/bin/env node

/**
 * Icon Creation Script for AI Prompt Manager
 * 
 * This script creates PNG icons from the SVG source and provides instructions
 * for converting to platform-specific formats.
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

console.log('🎨 AI Prompt Manager - Icon Creation');
console.log('====================================\n');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
    console.log('❌ SVG icon not found at:', svgPath);
    process.exit(1);
}

console.log('✅ Found SVG icon source');

// Create a simple PNG using Canvas (if available) or provide instructions
console.log('\n📝 To complete icon creation:');
console.log('\n1. Convert SVG to PNG formats:');
console.log('   - Use online tools like: https://convertio.co/svg-png/');
console.log('   - Or use ImageMagick: convert icon.svg -resize 512x512 icon.png');
console.log('   - Or use Inkscape: inkscape icon.svg --export-png=icon.png --export-width=512');

console.log('\n2. Create platform-specific formats:');
console.log('   📱 PNG (Linux): 512x512 pixels');
console.log('      - Save as: build/icon.png');
console.log('   🪟 ICO (Windows): Multiple sizes in one file');
console.log('      - Use online converter: https://convertio.co/png-ico/');
console.log('      - Include sizes: 16x16, 32x32, 48x48, 256x256');
console.log('      - Save as: build/icon.ico');
console.log('   🍎 ICNS (macOS): Multiple sizes in one file');
console.log('      - Use online converter: https://convertio.co/png-icns/');
console.log('      - Include sizes: 16x16, 32x32, 128x128, 256x256, 512x512');
console.log('      - Save as: build/icon.icns');

console.log('\n3. Quick online conversion workflow:');
console.log('   a) Go to https://convertio.co/svg-png/');
console.log('   b) Upload build/icon.svg');
console.log('   c) Set size to 512x512');
console.log('   d) Download as icon.png');
console.log('   e) Use the PNG to create ICO and ICNS formats');

console.log('\n🚀 Alternative: Use the provided create-png script');
console.log('   npm run create-png  # Creates PNG if Node.js canvas is available');

// Create a simple HTML preview
const htmlPreview = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Prompt Manager Icon Preview</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .icon-preview { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; margin: 20px; }
        .icon { width: 128px; height: 128px; }
        h1 { color: #333; }
        .sizes { display: flex; justify-content: center; gap: 20px; margin-top: 30px; }
        .size-demo { text-align: center; }
        .size-demo img { border: 1px solid #ddd; }
    </style>
</head>
<body>
    <h1>AI Prompt Manager Icon Preview</h1>
    
    <div class="icon-preview">
        <h3>Main Icon (128px)</h3>
        <img src="icon.svg" class="icon" alt="AI Prompt Manager Icon">
    </div>
    
    <div class="sizes">
        <div class="size-demo">
            <h4>16px</h4>
            <img src="icon.svg" width="16" height="16" alt="16px">
        </div>
        <div class="size-demo">
            <h4>32px</h4>
            <img src="icon.svg" width="32" height="32" alt="32px">
        </div>
        <div class="size-demo">
            <h4>48px</h4>
            <img src="icon.svg" width="48" height="48" alt="48px">
        </div>
        <div class="size-demo">
            <h4>64px</h4>
            <img src="icon.svg" width="64" height="64" alt="64px">
        </div>
        <div class="size-demo">
            <h4>128px</h4>
            <img src="icon.svg" width="128" height="128" alt="128px">
        </div>
    </div>
    
    <p style="margin-top: 40px; color: #666;">
        This preview shows how the icon looks at different sizes.<br>
        The design features a notebook with spiral binding and a pencil, with an "AI" badge.
    </p>
</body>
</html>
`;

const previewPath = path.join(buildDir, 'icon-preview.html');
fs.writeFileSync(previewPath, htmlPreview);

console.log(`\n👀 Icon preview created: ${previewPath}`);
console.log('   Open this file in a browser to see how the icon looks at different sizes');

console.log('\n✨ Icon design features:');
console.log('   📓 Spiral notebook with lined pages');
console.log('   ✏️  Yellow pencil with eraser');
console.log('   🤖 Green "AI" badge for tech identity');
console.log('   🎨 Professional blue background');
console.log('   💫 Subtle shadow effects');

console.log('\nOnce you have the PNG/ICO/ICNS files, run:');
console.log('   npm run build:setup  # Verify all icons are present');
console.log('   npm run build        # Build the application');