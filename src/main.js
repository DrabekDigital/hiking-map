const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Security: Input validation functions
function validateFolderName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 255) return false;
  // Prevent dangerous characters and path traversal
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) return false;
  if (/^\.+$/.test(name)) return false; // Prevent . and ..
  if (name.includes('..')) return false; // Extra protection
  return true;
}

function sanitizeFilePath(filePath, basePath) {
  const resolved = path.resolve(basePath, filePath);
  const baseResolved = path.resolve(basePath);
  return resolved.startsWith(baseResolved) ? resolved : null;
}

function validateColorHex(color) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

let mainWindow;

// Get platform-specific app data directory
function getAppDataPath() {
  const platform = process.platform;
  const isDevMode = process.argv.includes('--dev');
  let appDataPath;
  
  if (platform === 'darwin') {
    if (isDevMode) {
      appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'Hiking Map Dev');
    } else {
      appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'Hiking Map');
    }
  } else if (platform === 'win32') {
    if (isDevMode) {
      appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Hiking Map Dev');
    } else {
      appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Hiking Map');
    }
  } else {
    if (isDevMode) {
      appDataPath = path.join(os.homedir(), '.hiking-map-dev');
    } else {
      appDataPath = path.join(os.homedir(), '.hiking-map');
    }
  }
  
  return appDataPath;
}

// Ensure GPX directory exists
async function ensureGpxDirectory() {
  const gpxPath = path.join(getAppDataPath(), 'gpx');
  await fs.ensureDir(gpxPath);
  return gpxPath;
}

function createWindow() {
  const isDevMode = process.argv.includes('--dev');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '..', 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDevMode // Disable dev tools in production
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('src/index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Open DevTools in development
  if (isDevMode) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Settings management
async function getSettingsPath() {
  const appDataPath = getAppDataPath();
  await fs.ensureDir(appDataPath);
  return path.join(appDataPath, 'settings.json');
}

async function loadSettings() {
  try {
    const settingsPath = await getSettingsPath();
    const settingsExist = await fs.pathExists(settingsPath);
    
    if (settingsExist) {
      const settings = await fs.readJson(settingsPath);
      return settings;
    }
    
    // Default settings
    return {
      map: {
        center: [49.2827, -123.1207], // Vancouver, BC
        zoom: 10
      },
      mapProvider: 'osm', // 'osm' or 'mapy'
      mapy: {
        apiKey: '',
        style: 'basic' // 'basic', 'outdoor', 'winter', 'aerial'
      },
      desaturateMap: false
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      map: {
        center: [49.2827, -123.1207],
        zoom: 10
      },
      mapProvider: 'osm',
      mapy: {
        apiKey: '',
        style: 'basic'
      },
      desaturateMap: false
    };
  }
}

async function saveSettings(settings) {
  try {
    const settingsPath = await getSettingsPath();
    await fs.writeJson(settingsPath, settings, { spaces: 2 });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// IPC handlers
ipcMain.handle('get-app-data-path', async () => {
  return await ensureGpxDirectory();
});

ipcMain.handle('load-settings', async () => {
  return await loadSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  await saveSettings(settings);
});

// Folder configuration management
async function getFolderConfig(folderPath) {
  try {
    const configPath = path.join(folderPath, '.hiking-map');
    const configExists = await fs.pathExists(configPath);
    
    if (configExists) {
      const config = await fs.readJson(configPath);
      return config;
    }
    
    // Default config
    return {
      color: '#FF6600' // Default orange color
    };
  } catch (error) {
    console.error('Error loading folder config:', error);
    return { color: '#FF6600' };
  }
}

async function saveFolderConfig(folderPath, config) {
  try {
    const configPath = path.join(folderPath, '.hiking-map');
    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    console.error('Error saving folder config:', error);
    throw error;
  }
}

// Recursive function to read directory structure
async function readDirectoryStructure(dirPath, relativePath = '') {
  const items = [];
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    // Skip hidden files and system files, but allow .hiking-map
    if (file.name.startsWith('.') && file.name !== '.hiking-map') continue;
    
    const fullPath = path.join(dirPath, file.name);
    const itemRelativePath = relativePath ? path.join(relativePath, file.name) : file.name;
    
    if (file.isDirectory()) {
      // Read folder configuration
      const folderConfig = await getFolderConfig(fullPath);
      
      // Recursively read subdirectory
      const children = await readDirectoryStructure(fullPath, itemRelativePath);
      
      items.push({
        name: file.name,
        type: 'folder',
        children: children,
        path: itemRelativePath,
        color: folderConfig.color
      });
    } else if (file.name.endsWith('.gpx')) {
      items.push({
        name: file.name,
        path: fullPath,
        type: 'file'
      });
    }
  }
  
  return items;
}

ipcMain.handle('get-gpx-files', async () => {
  try {
    const gpxPath = await ensureGpxDirectory();
    console.log('GPX directory path:', gpxPath);
    
    const result = await readDirectoryStructure(gpxPath);
    
    console.log('GPX files result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error reading GPX files:', error);
    return [];
  }
});

ipcMain.handle('read-gpx-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading GPX file:', error);
    throw error;
  }
});

ipcMain.handle('upload-gpx-files', async (event, targetFolder = null) => {
  console.log('Opening file dialog for GPX upload...');
  console.log('Target folder:', targetFolder);
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'GPX Files', extensions: ['gpx'] }
    ]
  });

  console.log('Dialog result:', result);

  if (!result.canceled && result.filePaths.length > 0) {
    const gpxPath = await ensureGpxDirectory();
    
    // Determine destination path
    let destDir = gpxPath;
    if (targetFolder) {
      destDir = path.join(gpxPath, targetFolder);
      await fs.ensureDir(destDir); // Ensure the target folder exists
    }
    
    console.log('Copying files to:', destDir);
    const uploadedFiles = [];

    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      
      // Security: Validate file extension
      if (!fileName.toLowerCase().endsWith('.gpx')) {
        console.error(`Skipping invalid file type: ${fileName}`);
        continue;
      }
      
      // Security: Validate file size
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > 50 * 1024 * 1024) { // 50MB limit
          console.error(`Skipping file too large: ${fileName}`);
          continue;
        }
      } catch (error) {
        console.error(`Error checking file stats: ${fileName}`, error);
        continue;
      }
      
      const destPath = path.join(destDir, fileName);
      
      console.log(`Copying ${fileName} from ${filePath} to ${destPath}`);
      
      try {
        await fs.copy(filePath, destPath);
        uploadedFiles.push({
          name: fileName,
          path: destPath,
          type: 'file'
        });
        console.log(`Successfully copied ${fileName}`);
      } catch (error) {
        console.error(`Error copying file ${fileName}:`, error);
      }
    }

    console.log('Upload completed. Uploaded files:', uploadedFiles);
    return uploadedFiles;
  }

  console.log('No files selected or dialog was cancelled');
  return [];
});

ipcMain.handle('create-folder', async (event, folderName, parentFolder = null) => {
  try {
    // Security: Validate folder name
    if (!validateFolderName(folderName)) {
      throw new Error('Invalid folder name. Use only letters, numbers, spaces, and basic punctuation.');
    }
    
    const gpxPath = await ensureGpxDirectory();
    
    let folderPath;
    if (parentFolder) {
      // Security: Validate parent folder path
      const sanitizedParentPath = sanitizeFilePath(parentFolder, gpxPath);
      if (!sanitizedParentPath) {
        throw new Error('Invalid parent folder path.');
      }
      folderPath = path.join(sanitizedParentPath, folderName);
    } else {
      // Create root level folder
      folderPath = path.join(gpxPath, folderName);
    }
    
    // Security: Final path validation
    if (!sanitizeFilePath(folderPath, gpxPath)) {
      throw new Error('Invalid folder path.');
    }
    
    console.log(`Creating folder: ${folderPath}`);
    await fs.ensureDir(folderPath);
    
    return { 
      name: folderName, 
      type: 'folder', 
      children: [],
      parentFolder: parentFolder 
    };
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
});

ipcMain.handle('delete-item', async (event, item) => {
  try {
    const gpxPath = await ensureGpxDirectory();
    
    if (item.type === 'file') {
      // Delete single file
      console.log(`Deleting file: ${item.path}`);
      await fs.remove(item.path);
    } else if (item.type === 'folder') {
      // Delete folder and all contents
      const folderPath = path.join(gpxPath, item.name);
      console.log(`Deleting folder: ${folderPath}`);
      await fs.remove(folderPath);
    }
    
    console.log(`Successfully deleted ${item.type}: ${item.name}`);
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
});

ipcMain.handle('set-folder-color', async (event, folderPath, color) => {
  try {
    // Security: Validate color format
    if (!validateColorHex(color)) {
      throw new Error('Invalid color format. Use hex format like #FF6600.');
    }
    
    const gpxPath = await ensureGpxDirectory();
    
    // Security: Validate folder path
    const fullFolderPath = sanitizeFilePath(folderPath, gpxPath);
    if (!fullFolderPath) {
      throw new Error('Invalid folder path.');
    }
    
    // Read existing config or create new one
    const config = await getFolderConfig(fullFolderPath);
    config.color = color;
    
    // Save updated config
    await saveFolderConfig(fullFolderPath, config);
    
    console.log(`Set color for folder ${folderPath}: ${color}`);
    return true;
  } catch (error) {
    console.error('Error setting folder color:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  // Always quit the app when all windows are closed, including on macOS
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 