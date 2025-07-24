#!/usr/bin/env node

/**
 * Build Setup Script for AI Prompt Manager
 * 
 * This script helps set up the build environment and creates placeholder icons
 * if they don't exist, allowing developers to test the build process.
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const iconFiles = [
    { name: 'icon.png', description: 'Linux icon (512x512 PNG)' },
    { name: 'icon.ico', description: 'Windows icon (256x256 ICO)' },
    { name: 'icon.icns', description: 'macOS icon (512x512 ICNS)' }
];

console.log('🚀 AI Prompt Manager - Build Setup');
console.log('=====================================\n');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    console.log('✅ Created build directory');
}

// Check for icon files
let missingIcons = [];
iconFiles.forEach(icon => {
    const iconPath = path.join(buildDir, icon.name);
    if (!fs.existsSync(iconPath)) {
        missingIcons.push(icon);
    } else {
        console.log(`✅ Found ${icon.name}`);
    }
});

if (missingIcons.length > 0) {
    console.log('\n⚠️  Missing icon files:');
    missingIcons.forEach(icon => {
        console.log(`   - ${icon.name}: ${icon.description}`);
    });
    
    console.log('\n📝 To complete the build setup:');
    console.log('   1. Create or obtain application icons');
    console.log('   2. Place them in the build/ directory');
    console.log('   3. See build/README.md for detailed requirements');
    
    console.log('\n🔧 For testing purposes, you can:');
    console.log('   - Use online icon generators');
    console.log('   - Convert a PNG to other formats using online tools');
    console.log('   - Create simple placeholder icons');
    
    process.exit(1);
} else {
    console.log('\n✅ All icon files found!');
    console.log('\n🎉 Build environment is ready!');
    console.log('\nNext steps:');
    console.log('   npm run build        # Build for current platform');
    console.log('   npm run build:win    # Build for Windows');
    console.log('   npm run build:mac    # Build for macOS');
    console.log('   npm run build:linux  # Build for Linux');
}