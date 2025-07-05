# Hiking Map - GPX Track Visualizer

A modern Electron desktop application for visualizing and managing your hiking GPX tracks on OpenStreetMap.

## Features

- 🗺️ **Multiple Map Providers**: Choose between OpenStreetMap (free) and Mapy.cz (Czech maps)
- 📁 **Advanced File Management**: Organize GPX files in nested folders with selection and checkbox visibility
- 🗂️ **Multi-Level Nesting**: Create unlimited depth folder structures for complex organization
- 🎨 **Track Visualization**: All tracks displayed in bright orange with elevation/distance info
- 📤 **Smart Upload**: Upload files to root or selected folders with visual feedback
- ☑️ **Checkbox Controls**: Individual visibility control for each file and folder
- 🎯 **Selection System**: Clear visual selection with blue highlighting and upload targeting
- 🗑️ **Individual Delete**: Hover-to-reveal trash icons for direct file/folder deletion
- ⚡ **Quick Controls**: Select all / deselect all tracks with one click
- 💾 **Platform Storage**: GPX files stored in your system's app data folder
- 🔍 **Track Details**: Click on tracks to see distance and elevation information
- 🗺️ **Map Controls**: Fit all tracks to view or clear the map
- 💾 **Position Memory**: Map remembers your last viewed location and zoom level
- ⚙️ **Settings Panel**: Configure map provider and API keys through an intuitive interface
- 🇨🇿 **Mapy.cz Integration**: Support for Czech Mapy.cz with multiple map styles
- 📱 **Modern UI**: Clean, responsive interface optimized for desktop

## Screenshot

![Screenshot](promo/screenshot.png)


## Installation

0. See releases for provided precompiled builds.

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run in development mode**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Build for macOS**:
   ```bash
   npm run build-mac
   ```

## Usage

### Getting Started

1. Launch the application
2. The map will initialize with OpenStreetMap tiles
3. Use the sidebar to manage your GPX tracks

### Uploading GPX Files

1. Click the **"Upload GPX"** button in the sidebar
2. Select one or more GPX files from your computer
3. Files will be copied to your app data folder and appear in the file tree

### Organizing Files

1. Click **"New Folder"** to create folders for organizing tracks
2. You can organize tracks by trip, year, difficulty, etc.
3. Folders can be expanded/collapsed by clicking the arrow

### Managing Files and Folders

1. **Selecting Items**: Click on any file or folder to select it (highlighted in blue)
2. **Uploading to Folders**: Select a folder first, then click "Upload GPX" to add files to that folder
3. **Creating Folders**: Click "New Folder" to create a new folder
   - If no folder is selected: Creates folder at root level
   - If a folder is selected: Creates nested folder inside the selected folder
4. **Nested Organization**: Create multi-level folder structures for complex organization
5. **Visibility Control**: Use checkboxes next to files/folders to show/hide tracks on the map
6. **Deleting Items**: Hover over any file or folder to reveal a "🗑️" trash icon - click to delete
7. **Quick Controls**: Use "☑️ Select All" and "☐ Deselect All" to quickly manage visibility
8. **Clear Selection**: Click on empty space in the file tree to clear selection

### Viewing Tracks

1. Check/uncheck the boxes next to GPX files to show/hide them on the map
2. Check/uncheck folder boxes to show/hide all tracks in that folder
3. All tracks are displayed in bright orange color for visibility
4. Click on tracks on the map to see detailed information (distance, elevation)

### Map Controls

- **Fit All Tracks**: Zoom to show all visible tracks
- **Clear Map**: Hide all tracks from the map
- **Settings**: Configure map provider and API keys
- Use mouse wheel to zoom, drag to pan
- Click and drag to select areas

### Configuring Mapy.cz

1. Click the **⚙️ Settings** button in the map controls
2. Select **Mapy.cz (Czech Maps)** as your map provider
3. Enter your Mapy.cz API key:
   - Get a free API key at [developer.mapy.com](https://developer.mapy.com/)
   - Create an account and generate an API key
   - Paste the key into the settings modal
4. Choose your preferred map style:
   - **Basic**: Standard street map
   - **Outdoor**: Topographic map with hiking trails
   - **Winter**: Winter sports and skiing map
   - **Aerial**: Satellite/aerial imagery
5. Click **Save Settings** to apply changes

The map will immediately switch to Mapy.cz tiles with proper Czech attribution.

## File Storage Locations

GPX files and settings are automatically stored in platform-specific locations:

**GPX Files:**
- **macOS**: `~/Library/Application Support/Hiking Map/gpx/`
- **Windows**: `%APPDATA%/Hiking Map/gpx/`
- **Linux**: `~/.hiking-map/gpx/`

**Settings (including map position):**
- **macOS**: `~/Library/Application Support/Hiking Map/settings.json`
- **Windows**: `%APPDATA%/Hiking Map/settings.json`
- **Linux**: `~/.hiking-map/settings.json`

## Supported GPX Features

- Track points (trkpt) with latitude/longitude
- Elevation data
- Multiple track segments
- Track names and metadata

## Technical Details

### Built With

- **Electron**: Cross-platform desktop app framework
- **Leaflet**: Interactive map library
- **OpenStreetMap**: Free map tiles and data
- **Mapy.cz REST API**: Czech map provider with detailed local maps
- **Node.js**: Backend file handling
- **Vanilla JavaScript**: No heavy frameworks, fast and lightweight

### Architecture

- **Main Process** (`src/main.js`): Handles file system operations and IPC
- **Renderer Process** (`src/renderer.js`): UI logic and map management
- **IPC Communication**: Secure communication between processes
- **Platform-specific storage**: Follows OS conventions for app data

## Development

### Project Structure

```
hiking-map/
├── src/
│   ├── main.js          # Main Electron process
│   ├── renderer.js      # Renderer process (UI logic)
│   ├── index.html       # Main UI layout
│   └── styles.css       # Application styles
├── package.json         # Dependencies and build config
└── README.md           # This file
```

### Development Commands

- `npm start` - Run the application
- `npm run dev` - Run with developer tools open
- `npm run build` - Build for all platforms
- `npm run build-mac` - Build specifically for macOS

### Debugging

- Developer tools are automatically opened in development mode
- Check the console for any errors or debugging information
- IPC communication logs are shown in both main and renderer processes

## Troubleshooting

### Common Issues

1. **GPX files not showing**: Ensure files have `.gpx` extension and valid XML format
2. **Map not loading**: Check internet connection for OpenStreetMap tiles
3. **Upload fails**: Verify file system permissions for app data directory

### Error Messages

- Files are validated during upload and parsing
- Error messages appear in alerts (can be enhanced with better notifications)
- Check developer console for detailed error information

## Contributing

This is a basic implementation that can be extended with:

- Better error handling and notifications
- Track statistics and analysis
- Export functionality
- Different map tile providers
- Waypoint support
- Route planning features

## License

MIT License - feel free to modify and distribute.

---

**Happy Hiking! 🥾⛰️** 