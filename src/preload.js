const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  getGpxFiles: () => ipcRenderer.invoke('get-gpx-files'),
  readGpxFile: (filePath) => ipcRenderer.invoke('read-gpx-file', filePath),
  uploadGpxFiles: (targetFolder) => ipcRenderer.invoke('upload-gpx-files', targetFolder),
  deleteItem: (item) => ipcRenderer.invoke('delete-item', item),
  
  // Folder operations
  createFolder: (folderName, parentFolder) => ipcRenderer.invoke('create-folder', folderName, parentFolder),
  setFolderColor: (folderPath, color) => ipcRenderer.invoke('set-folder-color', folderPath, color),
  
  // Settings operations
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // App data
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path')
}); 