# Deployment Guide

This guide explains how to build and distribute the AI Prompt Manager application.

## Prerequisites

1. **Node.js** (v14 or higher)
2. **npm** (v6 or higher)
3. **Platform-specific tools** (see below)

## Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add application icons** (see `build/README.md` for details):
   - `build/icon.icns` (macOS)
   - `build/icon.ico` (Windows)
   - `build/icon.png` (Linux)

## Building Distributables

### Build for Current Platform
```bash
npm run build
```

### Build for Specific Platforms
```bash
npm run build:win     # Windows installer + portable
npm run build:mac     # macOS DMG + ZIP
npm run build:linux   # AppImage + DEB + RPM
```

### Development Build (No Packaging)
```bash
npm run pack
```

## Platform-Specific Requirements

### Windows
- **No additional requirements** for building Windows executables on any platform
- Outputs:
  - NSIS installer (`.exe`)
  - Portable executable

### macOS
- **macOS required** for building `.dmg` and code-signed apps
- Outputs:
  - DMG installer
  - ZIP archive
- For code signing, add to `package.json`:
  ```json
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name"
    }
  }
  ```

### Linux
- **No additional requirements**
- Outputs:
  - AppImage (universal Linux)
  - DEB package (Debian/Ubuntu)
  - RPM package (RedHat/Fedora)

## Output Location

All built files are placed in the `dist/` directory:
```
dist/
├── AI Prompt Manager-1.0.0.dmg           # macOS installer
├── AI Prompt Manager-1.0.0-mac.zip       # macOS archive
├── AI Prompt Manager Setup 1.0.0.exe     # Windows installer
├── AI Prompt Manager 1.0.0.exe           # Windows portable
├── AI Prompt Manager-1.0.0.AppImage      # Linux AppImage
├── ai-prompt-manager_1.0.0_amd64.deb     # Linux DEB
└── ai-prompt-manager-1.0.0.x86_64.rpm    # Linux RPM
```

## Automated Builds with GitHub Actions

Create `.github/workflows/build.yml` for automated builds:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      
      - uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/
```

## Code Signing

### macOS
1. Get Apple Developer ID certificate
2. Add to keychain
3. Update `package.json`:
   ```json
   "build": {
     "mac": {
       "identity": "Developer ID Application: Your Name",
       "hardenedRuntime": true,
       "entitlements": "build/entitlements.mac.plist"
     }
   }
   ```

### Windows
1. Get code signing certificate
2. Add to `package.json`:
   ```json
   "build": {
     "win": {
       "certificateFile": "path/to/certificate.p12",
       "certificatePassword": "password"
     }
   }
   ```

## Auto-Updates

To enable auto-updates, configure the publish settings in `package.json`:

```json
"build": {
  "publish": {
    "provider": "github",
    "owner": "agileandy",
    "repo": "promptManager-Electron"
  }
}
```

Then use `electron-updater` in your main process.

## Testing Builds

1. **Test locally**: Use `npm run pack` to create unpackaged builds
2. **Test installation**: Install the generated packages on target systems
3. **Test functionality**: Verify all features work in the packaged version
4. **Test updates**: If using auto-updates, test the update mechanism

## Troubleshooting

### Common Issues

1. **Missing icons**: Add placeholder icons to `build/` directory
2. **Permission errors**: Ensure proper file permissions on build files
3. **Code signing failures**: Verify certificates and entitlements
4. **Large bundle size**: Use `--analyze` flag to identify large dependencies

### Debug Build Process
```bash
DEBUG=electron-builder npm run build
```

### Clean Build
```bash
rm -rf dist/ node_modules/
npm install
npm run build
```

## Distribution

1. **GitHub Releases**: Upload built files to GitHub releases
2. **Direct Download**: Host files on your own server
3. **Package Managers**: Submit to platform-specific stores
4. **Auto-Updates**: Use electron-updater for seamless updates

## Security Considerations

1. **Code Signing**: Always sign production releases
2. **Update Security**: Use HTTPS for update servers
3. **Dependency Scanning**: Regularly audit npm dependencies
4. **Sandboxing**: Consider enabling Electron's sandbox mode

This deployment setup provides a robust foundation for distributing the AI Prompt Manager across all major platforms.