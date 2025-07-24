#!/usr/bin/env node

/**
 * PNG Creation Script for AI Prompt Manager
 * 
 * This script attempts to create a PNG version of the icon using various methods.
 * Falls back to providing manual instructions if automated conversion isn't available.
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');
const pngPath = path.join(buildDir, 'icon.png');

console.log('🖼️  PNG Icon Creation');
console.log('====================\n');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
    console.log('❌ SVG icon not found. Run: npm run create-icons first');
    process.exit(1);
}

// Try to create PNG using different methods
async function createPNG() {
    // Method 1: Try using sharp (if available)
    try {
        const sharp = require('sharp');
        await sharp(svgPath)
            .resize(512, 512)
            .png()
            .toFile(pngPath);
        console.log('✅ PNG created using Sharp');
        return true;
    } catch (error) {
        console.log('ℹ️  Sharp not available, trying next method...');
    }

    // Method 2: Try using canvas (if available)
    try {
        const { createCanvas, loadImage } = require('canvas');
        const svgContent = fs.readFileSync(svgPath, 'utf8');
        
        // Create a data URL from SVG
        const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
        
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        
        const img = await loadImage(svgDataUrl);
        ctx.drawImage(img, 0, 0, 512, 512);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(pngPath, buffer);
        
        console.log('✅ PNG created using Canvas');
        return true;
    } catch (error) {
        console.log('ℹ️  Canvas not available, trying next method...');
    }

    // Method 3: Create a simple fallback PNG programmatically
    try {
        // Create a simple colored square as fallback
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        
        // Draw a simple icon-like shape
        ctx.fillStyle = '#4F46E5';
        ctx.fillRect(0, 0, 512, 512);
        
        // Add some basic shapes to represent notebook and pencil
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(100, 120, 200, 280);
        
        ctx.fillStyle = '#FCD34D';
        ctx.fillRect(320, 180, 80, 16);
        
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(380, 350, 25, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('AI', 380, 358);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(pngPath, buffer);
        
        console.log('✅ Fallback PNG created using Canvas');
        return true;
    } catch (error) {
        console.log('ℹ️  Canvas fallback not available...');
    }

    return false;
}

// Method 4: Provide manual instructions
function provideInstructions() {
    console.log('📝 Manual PNG Creation Required');
    console.log('================================\n');
    
    console.log('Since automated PNG creation isn\'t available, please:');
    console.log('\n1. 🌐 Use an online SVG to PNG converter:');
    console.log('   • Go to: https://convertio.co/svg-png/');
    console.log('   • Upload: build/icon.svg');
    console.log('   • Set size: 512x512 pixels');
    console.log('   • Download as: icon.png');
    console.log('   • Save to: build/icon.png');
    
    console.log('\n2. 🖥️  Use command line tools (if available):');
    console.log('   • ImageMagick: convert build/icon.svg -resize 512x512 build/icon.png');
    console.log('   • Inkscape: inkscape build/icon.svg --export-png=build/icon.png --export-width=512');
    
    console.log('\n3. 🎨 Use graphics software:');
    console.log('   • Open build/icon.svg in GIMP, Photoshop, or similar');
    console.log('   • Export as PNG at 512x512 pixels');
    console.log('   • Save as build/icon.png');
    
    console.log('\n4. 📦 Install dependencies for automated creation:');
    console.log('   • npm install sharp  # For automated SVG to PNG conversion');
    console.log('   • npm install canvas # Alternative conversion method');
    
    console.log('\nOnce you have build/icon.png, create other formats:');
    console.log('   • Windows ICO: https://convertio.co/png-ico/');
    console.log('   • macOS ICNS: https://convertio.co/png-icns/');
}

// Main execution
(async () => {
    const success = await createPNG();
    
    if (success) {
        console.log(`\n✅ PNG icon created: ${pngPath}`);
        console.log('\nNext steps:');
        console.log('1. Create ICO for Windows: https://convertio.co/png-ico/');
        console.log('2. Create ICNS for macOS: https://convertio.co/png-icns/');
        console.log('3. Run: npm run build:setup');
        console.log('4. Run: npm run build');
    } else {
        provideInstructions();
    }
})();