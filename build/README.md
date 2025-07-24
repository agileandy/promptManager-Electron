# Build Resources

This directory contains resources needed for building distributable versions of the AI Prompt Manager.

## Icons

To complete the build setup, you'll need to add the following icon files:

- `icon.icns` - macOS icon (512x512 px minimum)
- `icon.ico` - Windows icon (256x256 px minimum) 
- `icon.png` - Linux icon (512x512 px minimum)

## Icon Requirements

### macOS (.icns)
- Use tools like `iconutil` or online converters
- Should include multiple resolutions: 16x16, 32x32, 128x128, 256x256, 512x512

### Windows (.ico)
- Should include multiple resolutions: 16x16, 32x32, 48x48, 256x256
- Use tools like GIMP, Paint.NET, or online converters

### Linux (.png)
- Single PNG file at 512x512 pixels
- Transparent background recommended

## Creating Icons

You can create a simple placeholder icon or design a custom one. For a quick start, you can:

1. Create a 512x512 PNG with the app name/logo
2. Convert to the required formats using online tools
3. Place them in this directory

The build process will automatically use these icons for the respective platforms.