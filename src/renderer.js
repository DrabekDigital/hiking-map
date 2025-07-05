// Security: Safe HTML utilities
function createTextElement(tag, text, className = null) {
  const element = document.createElement(tag);
  element.textContent = text; // Safe - no HTML injection
  if (className) element.className = className;
  return element;
}

function sanitizeText(text) {
  return text.replace(/[<>&"']/g, function(char) {
    const entities = {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;'};
    return entities[char];
  });
}

class HikingMapApp {
  constructor() {
    this.map = null;
    this.gpxLayers = new Map();
    this.visibleTracks = new Set();
    this.fileTree = [];
    this.expandedFolders = new Set();
    this.settings = null;
    this.saveSettingsTimeout = null;
    this.currentTileLayer = null;
    this.currentAttribution = null;
    this.selectedItem = null; // Currently selected folder/file
    this.checkedItems = new Set(); // Items checked for visibility
    this.currentColorFolder = null; // Currently selected folder for color change
    this.currentColorIndicator = null; // The color indicator element being changed
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.initMap();
    this.setupEventListeners();
    await this.loadFileTree();
  }

  initMap() {
    // Initialize Leaflet map with saved position
    const center = this.settings?.map?.center || [49.2827, -123.1207];
    const zoom = this.settings?.map?.zoom || 10;
    
    this.map = L.map('map').setView(center, zoom);

    // Add appropriate tile layer based on settings
    this.setupTileLayer();

    // Add scale control
    L.control.scale().addTo(this.map);

    // Listen for map movement to save position
    this.map.on('moveend', () => {
      this.saveMapPosition();
    });

    this.map.on('zoomend', () => {
      this.saveMapPosition();
    });
  }

  setupTileLayer() {
    // Remove existing tile layer if any
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    const mapProvider = this.settings?.mapProvider || 'osm';
    
    if (mapProvider === 'mapy' && this.settings?.mapy?.apiKey) {
      this.setupMapyTileLayer();
    } else {
      this.setupOSMTileLayer();
    }
  }

  setupOSMTileLayer() {
    this.currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    });
    
    this.currentTileLayer.addTo(this.map);
    
    // Apply desaturation if enabled
    this.toggleMapDesaturation();
  }

  setupMapyTileLayer() {
    const apiKey = this.settings.mapy.apiKey;
    const style = this.settings.mapy.style || 'basic';
    
    // Map Mapy.cz styles to their API values
    const styleMapping = {
      'basic': 'basic',
      'outdoor': 'outdoor', 
      'winter': 'winter',
      'aerial': 'ophoto'
    };
    
    const mapyStyle = styleMapping[style] || 'basic';
    
    this.currentTileLayer = L.tileLayer(`https://api.mapy.cz/v1/maptiles/${mapyStyle}/256/{z}/{x}/{y}?apikey=${apiKey}`, {
      attribution: '© <a href="https://www.mapy.cz/">Mapy.cz</a>',
      maxZoom: 18
    });
    
    this.currentTileLayer.addTo(this.map);
    
    // Apply desaturation if enabled
    this.toggleMapDesaturation();
  }

  toggleMapDesaturation() {
    const mapElement = document.getElementById('map');
    const tilePanes = mapElement.querySelectorAll('.leaflet-tile-pane');
    
    if (this.settings?.desaturateMap) {
      // Add desaturation class
      tilePanes.forEach(pane => {
        pane.classList.add('desaturated');
      });
    } else {
      // Remove desaturation class
      tilePanes.forEach(pane => {
        pane.classList.remove('desaturated');
      });
    }
  }

  setupEventListeners() {
    // Upload button
    document.getElementById('uploadBtn').addEventListener('click', () => {
      this.uploadGpxFiles();
    });

    // Create folder button
    document.getElementById('createFolderBtn').addEventListener('click', () => {
      this.showCreateFolderModal();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.showSettingsModal();
    });

    // Quick controls
    document.getElementById('selectAllBtn').addEventListener('click', () => {
      this.selectAllItems();
    });

    document.getElementById('deselectAllBtn').addEventListener('click', () => {
      this.deselectAllItems();
    });

    // Map controls
    document.getElementById('fitBoundsBtn').addEventListener('click', () => {
      this.fitAllTracks();
    });

    // Modal controls
    document.getElementById('createFolderConfirm').addEventListener('click', () => {
      this.createFolder();
    });

    document.getElementById('cancelFolderCreate').addEventListener('click', () => {
      this.hideCreateFolderModal();
    });

    // Settings modal controls
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettingsFromModal();
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
      this.hideSettingsModal();
    });

    // Map provider radio buttons
    document.getElementById('osmRadio').addEventListener('change', () => {
      this.toggleMapySection();
    });

    document.getElementById('mapyRadio').addEventListener('change', () => {
      this.toggleMapySection();
    });

    // Color picker modal controls
    document.getElementById('confirmColorChange').addEventListener('click', () => {
      this.confirmColorChange();
    });

    document.getElementById('cancelColorChange').addEventListener('click', () => {
      this.hideColorModal();
    });

    document.getElementById('colorPicker').addEventListener('input', (e) => {
      this.updateColorPreview(e.target.value);
    });

    // Close modals on backdrop click
    document.getElementById('folderModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideCreateFolderModal();
      }
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideSettingsModal();
      }
    });

    document.getElementById('colorModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideColorModal();
      }
    });

    // Enter key on folder name input
    document.getElementById('folderNameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.createFolder();
      }
    });

    // Keyboard shortcuts for color modal
    document.addEventListener('keydown', (e) => {
      const colorModal = document.getElementById('colorModal');
      if (colorModal.classList.contains('show')) {
        if (e.key === 'Escape') {
          this.hideColorModal();
        } else if (e.key === 'Enter') {
          this.confirmColorChange();
        }
      }
    });

    // Clear selection when clicking on empty space in file tree
    document.getElementById('fileTree').addEventListener('click', (e) => {
      if (e.target.id === 'fileTree') {
        this.clearSelection();
      }
    });
  }

  async loadFileTree() {
    try {
      console.log('Loading file tree...');
      this.fileTree = await window.electronAPI.getGpxFiles();
      console.log('File tree loaded:', this.fileTree);
      
      // Initialize checked items if empty (first load)
      if (this.checkedItems.size === 0) {
        await this.initializeCheckedItems();
      }
      
      this.renderFileTree();
      this.updateTrackCount();
    } catch (error) {
      console.error('Error loading file tree:', error);
      this.showError('Failed to load GPX files: ' + error.message);
    }
  }

  async initializeCheckedItems() {
    // Check all items by default and show tracks
    await this.initializeItemsRecursive(this.fileTree);
  }

  async initializeItemsRecursive(items) {
    for (const item of items) {
      if (item.type === 'folder') {
        this.checkedItems.add(item.path || item.name);
        if (item.children) {
          await this.initializeItemsRecursive(item.children);
        }
      } else if (item.type === 'file') {
        this.checkedItems.add(item.path);
        await this.showTrack(item);
      }
    }
  }

  renderFileTree() {
    const fileTreeElement = document.getElementById('fileTree');
    
    if (this.fileTree.length === 0) {
      // Security: Use safe DOM methods instead of innerHTML
      fileTreeElement.textContent = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';
      loadingDiv.textContent = 'No GPX files found. Upload some tracks to get started!';
      fileTreeElement.appendChild(loadingDiv);
      return;
    }

    // Security: Clear content safely
    fileTreeElement.textContent = '';
    
    this.fileTree.forEach(item => {
      const itemElement = this.createTreeItem(item);
      fileTreeElement.appendChild(itemElement);
    });
  }

  createTreeItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';
    
    if (item.type === 'folder') {
      itemDiv.classList.add('folder');
      
      // Create the main row for the folder
      const rowDiv = document.createElement('div');
      rowDiv.className = 'tree-item-row';
      
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle';
      toggle.textContent = '▶';
      const folderPath = item.path || item.name;
      if (this.expandedFolders.has(folderPath)) {
        toggle.classList.add('expanded');
        toggle.textContent = '▼';
      }
      rowDiv.appendChild(toggle);
      
      // Checkbox for folder visibility
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'tree-checkbox';
      const folderKey = item.path || item.name;
      checkbox.checked = this.checkedItems.has(folderKey);
      rowDiv.appendChild(checkbox);
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'tree-item-content';
      
      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '📁';
      contentDiv.appendChild(icon);
      
      const name = document.createElement('span');
      name.className = 'tree-item-text';
      name.textContent = item.name;
      contentDiv.appendChild(name);
      
      // Color indicator for folder
      const colorIndicator = document.createElement('div');
      colorIndicator.className = 'folder-color-indicator';
      colorIndicator.style.backgroundColor = item.color || '#FF6600';
      colorIndicator.title = 'Click to change folder color';
      contentDiv.appendChild(colorIndicator);
      
      // Delete button for folder
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'tree-delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete folder';
      contentDiv.appendChild(deleteBtn);
      
      rowDiv.appendChild(contentDiv);
      itemDiv.appendChild(rowDiv);
      
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children';
      if (this.expandedFolders.has(folderPath)) {
        childrenDiv.classList.add('expanded');
      }
      
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => {
          const childElement = this.createTreeItem(child);
          childrenDiv.appendChild(childElement);
        });
      }
      
      itemDiv.appendChild(childrenDiv);
      
      // Check if this folder is selected
      if (this.selectedItem && this.selectedItem.type === 'folder') {
        const selectedPath = this.selectedItem.path || this.selectedItem.name;
        const currentPath = item.path || item.name;
        if (selectedPath === currentPath) {
          itemDiv.classList.add('selected');
        }
      }
      
      // Toggle folder
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolder(folderPath, toggle, childrenDiv);
      });
      
      // Checkbox change event
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleFolderVisibility(item, checkbox.checked);
      });
      
      // Color indicator click
      colorIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showColorPicker(item, colorIndicator);
      });

      // Delete button click
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(item);
      });

      // Folder click - toggle selection (but not on delete button or color indicator)
      rowDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target !== deleteBtn && e.target !== toggle && e.target !== checkbox && e.target !== colorIndicator) {
          this.toggleItemSelection(item);
        }
      });
      
    } else if (item.type === 'file') {
      itemDiv.classList.add('file');
      
      // Create the main row for the file
      const rowDiv = document.createElement('div');
      rowDiv.className = 'tree-item-row';
      
      // Checkbox for file visibility
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'tree-checkbox';
      checkbox.checked = this.checkedItems.has(item.path);
      rowDiv.appendChild(checkbox);
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'tree-item-content';
      
      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '🥾';
      contentDiv.appendChild(icon);
      
      const name = document.createElement('span');
      name.className = 'tree-item-text';
      name.textContent = item.name.replace('.gpx', '');
      contentDiv.appendChild(name);
      
      // Delete button for file
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'tree-delete';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete file';
      contentDiv.appendChild(deleteBtn);
      
      rowDiv.appendChild(contentDiv);
      itemDiv.appendChild(rowDiv);
      
      // Check if this file is selected
      if (this.selectedItem && this.selectedItem.path === item.path && this.selectedItem.type === 'file') {
        itemDiv.classList.add('selected');
      }
      
      // Checkbox change event
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleTrackVisibility(item, checkbox.checked);
      });
      
      // Delete button click
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(item);
      });

      // File click - toggle selection (but not on delete button)
      rowDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target !== deleteBtn && e.target !== checkbox) {
          this.toggleItemSelection(item);
        }
      });
    }
    
    return itemDiv;
  }

  toggleFolder(folderName, toggle, childrenDiv) {
    const isExpanded = this.expandedFolders.has(folderName);
    
    if (isExpanded) {
      this.expandedFolders.delete(folderName);
      toggle.classList.remove('expanded');
      childrenDiv.classList.remove('expanded');
      toggle.textContent = '▶';
    } else {
      this.expandedFolders.add(folderName);
      toggle.classList.add('expanded');
      childrenDiv.classList.add('expanded');
      toggle.textContent = '▼';
    }
  }

  selectItem(item) {
    this.selectedItem = item;
    this.updateSelectedInfo();
    this.renderFileTree();
  }

  toggleItemSelection(item) {
    // If the item is already selected, deselect it
    if (this.selectedItem && this.isItemSelected(item)) {
      this.clearSelection();
    } else {
      // Otherwise, select it
      this.selectItem(item);
    }
  }

  isItemSelected(item) {
    if (!this.selectedItem) return false;
    
    // For folders, compare by path or name
    if (item.type === 'folder' && this.selectedItem.type === 'folder') {
      const itemPath = item.path || item.name;
      const selectedPath = this.selectedItem.path || this.selectedItem.name;
      return itemPath === selectedPath;
    }
    
    // For files, compare by path
    if (item.type === 'file' && this.selectedItem.type === 'file') {
      return item.path === this.selectedItem.path;
    }
    
    return false;
  }

  clearSelection() {
    this.selectedItem = null;
    this.updateSelectedInfo();
    this.renderFileTree();
  }

  updateSelectedInfo() {
    const selectedInfo = document.getElementById('selectedInfo');
    const uploadBtnText = document.getElementById('uploadBtnText');
    
    // Security: Clear existing content safely
    selectedInfo.textContent = '';
    
    if (this.selectedItem) {
      if (this.selectedItem.type === 'folder') {
        const folderDisplayName = this.selectedItem.path || this.selectedItem.name;
        // Security: Use safe DOM methods instead of innerHTML
        const span = createTextElement('span', `📁 Selected: "${folderDisplayName}" - uploads will go here`);
        selectedInfo.appendChild(span);
        uploadBtnText.textContent = `Upload to "${folderDisplayName}"`;
      } else {
        const fileName = this.selectedItem.name.replace('.gpx', '');
        const span = createTextElement('span', `🥾 Selected: "${fileName}" (file)`);
        selectedInfo.appendChild(span);
        uploadBtnText.textContent = 'Upload GPX';
      }
    } else {
      const span = createTextElement('span', 'No folder selected - uploads to root');
      selectedInfo.appendChild(span);
      uploadBtnText.textContent = 'Upload GPX';
    }
  }

  async toggleFolderVisibility(folder, isChecked) {
    const folderKey = folder.path || folder.name;
    
    if (isChecked) {
      this.checkedItems.add(folderKey);
      // Show all tracks in folder recursively
      if (folder.children) {
        await this.toggleChildrenRecursive(folder.children, true);
      }
    } else {
      this.checkedItems.delete(folderKey);
      // Hide all tracks in folder recursively
      if (folder.children) {
        await this.toggleChildrenRecursive(folder.children, false);
      }
    }
    
    this.renderFileTree();
  }

  async toggleChildrenRecursive(children, isChecked) {
    for (const child of children) {
      if (child.type === 'folder') {
        const childKey = child.path || child.name;
        if (isChecked) {
          this.checkedItems.add(childKey);
        } else {
          this.checkedItems.delete(childKey);
        }
        
        if (child.children) {
          await this.toggleChildrenRecursive(child.children, isChecked);
        }
      } else if (child.type === 'file') {
        if (isChecked) {
          this.checkedItems.add(child.path);
          await this.showTrack(child);
        } else {
          this.checkedItems.delete(child.path);
          this.hideTrack(child);
        }
      }
    }
  }

  async toggleTrackVisibility(track, isChecked) {
    if (isChecked) {
      this.checkedItems.add(track.path);
      await this.showTrack(track);
    } else {
      this.checkedItems.delete(track.path);
      this.hideTrack(track);
    }
    
    this.renderFileTree();
  }

  async showTrack(track) {
    try {
      if (this.gpxLayers.has(track.path)) {
        // Track already loaded, just show it
        const layer = this.gpxLayers.get(track.path);
        layer.addTo(this.map);
        this.visibleTracks.add(track.path);
        return;
      }

      // Load and parse GPX file
      const gpxContent = await window.electronAPI.readGpxFile(track.path);
      const gpxData = this.parseGpx(gpxContent);
      
      if (!gpxData || gpxData.length === 0) {
        throw new Error('No track data found in GPX file');
      }

      // Create Leaflet layer
      const color = this.generateTrackColor(track.path);
      const layer = L.layerGroup();
      
      gpxData.forEach(segment => {
        // Create white border/shadow polyline (thicker, underneath)
        const borderPolyline = L.polyline(segment.points, {
          color: '#FFFFFF',
          weight: 8,
          opacity: 1.0
        });
        
        // Create main orange track polyline (on top)
        const polyline = L.polyline(segment.points, {
          color: color,
          weight: 3,
          opacity: 0.8
        });
        
        // Add popup with track info to the main polyline
        const popup = this.createTrackPopup(track, segment);
        polyline.bindPopup(popup);
        
        // Add both polylines to the layer (border first, then main track)
        layer.addLayer(borderPolyline);
        layer.addLayer(polyline);
      });
      
      this.gpxLayers.set(track.path, layer);
      layer.addTo(this.map);
      this.visibleTracks.add(track.path);
      
    } catch (error) {
      console.error('Error loading track:', error);
      this.showError(`Failed to load track: ${track.name}`);
    }
  }

  hideTrack(track) {
    if (this.gpxLayers.has(track.path)) {
      const layer = this.gpxLayers.get(track.path);
      this.map.removeLayer(layer);
      this.visibleTracks.delete(track.path);
    }
  }

  parseGpx(gpxContent) {
    try {
      // Security: Validate XML size to prevent DoS
      if (gpxContent.length > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('GPX file too large. Maximum size is 50MB.');
      }
      
      // Security: Basic XML structure validation
      if (!gpxContent.includes('<gpx') || !gpxContent.includes('</gpx>')) {
        throw new Error('Invalid GPX file format.');
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
      
      // Security: Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error('Invalid XML format in GPX file.');
      }
      
      const tracks = [];
      const trkElements = xmlDoc.getElementsByTagName('trk');
      
      for (let i = 0; i < trkElements.length; i++) {
        const trk = trkElements[i];
        const trkSegs = trk.getElementsByTagName('trkseg');
        
        for (let j = 0; j < trkSegs.length; j++) {
          const trkSeg = trkSegs[j];
          const trkPts = trkSeg.getElementsByTagName('trkpt');
          
          const points = [];
          let totalDistance = 0;
          let minEle = Infinity;
          let maxEle = -Infinity;
          
          for (let k = 0; k < trkPts.length; k++) {
            const pt = trkPts[k];
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            
            if (!isNaN(lat) && !isNaN(lon)) {
              const eleElement = pt.getElementsByTagName('ele')[0];
              const elevation = eleElement ? parseFloat(eleElement.textContent) : null;
              
              if (elevation !== null) {
                minEle = Math.min(minEle, elevation);
                maxEle = Math.max(maxEle, elevation);
              }
              
              points.push([lat, lon]);
              
              // Calculate distance
              if (k > 0) {
                const prevPt = points[k - 1];
                totalDistance += this.calculateDistance(prevPt[0], prevPt[1], lat, lon);
              }
            }
          }
          
          if (points.length > 0) {
            tracks.push({
              points: points,
              distance: totalDistance,
              minElevation: minEle === Infinity ? null : minEle,
              maxElevation: maxEle === -Infinity ? null : maxEle
            });
          }
        }
      }
      
      return tracks;
    } catch (error) {
      console.error('Error parsing GPX:', error);
      return [];
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  generateTrackColor(trackPath) {
    // Find the parent folder color for this track
    const folderColor = this.findParentFolderColor(trackPath);
    return folderColor || '#FF6600'; // Default to orange if no folder color found
  }

  findParentFolderColor(trackPath) {
    // Find the track in our file tree and get its parent folder
    const trackFolder = this.findTrackParentFolder(this.fileTree, trackPath);
    return trackFolder ? trackFolder.color : null;
  }

  findTrackParentFolder(items, trackPath) {
    for (const item of items) {
      if (item.type === 'folder') {
        // Check if this folder contains the track directly
        if (item.children) {
          for (const child of item.children) {
            if (child.type === 'file' && child.path === trackPath) {
              return item; // Found the parent folder
            }
          }
          
          // Search recursively in subfolders
          const found = this.findTrackParentFolder(item.children, trackPath);
          if (found) return found;
        }
      }
    }
    return null;
  }



  createTrackPopup(track, segment) {
    const distance = segment.distance.toFixed(2);
    const elevation = segment.minElevation && segment.maxElevation
      ? `${segment.minElevation.toFixed(0)}m - ${segment.maxElevation.toFixed(0)}m`
      : 'N/A';
    
    return `
      <div style="font-family: inherit;">
        <h4 style="margin: 0 0 8px 0; color: #24292e;">${track.name.replace('.gpx', '')}</h4>
        <div style="font-size: 12px; color: #586069;">
          <div>📏 Distance: ${distance} km</div>
          <div>⛰️ Elevation: ${elevation}</div>
        </div>
      </div>
    `;
  }

  fitAllTracks() {
    if (this.visibleTracks.size === 0) {
      this.showError('No tracks visible on map');
      return;
    }

    const group = L.featureGroup();
    this.visibleTracks.forEach(trackPath => {
      const layerGroup = this.gpxLayers.get(trackPath);
      if (layerGroup) {
        // LayerGroup contains polylines, we need to add each polyline to the FeatureGroup
        layerGroup.eachLayer(polyline => {
          group.addLayer(polyline);
        });
      }
    });

    if (group.getLayers().length > 0) {
      this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
    } else {
      this.showError('No tracks available to fit');
    }
  }



  async uploadGpxFiles() {
    try {
      console.log('Starting GPX file upload...');
      
      // Determine target folder
      let targetFolder = null;
      if (this.selectedItem && this.selectedItem.type === 'folder') {
        targetFolder = this.selectedItem.path || this.selectedItem.name;
        console.log('Selected folder for upload:', targetFolder);
      }
      
      const uploadedFiles = await window.electronAPI.uploadGpxFiles(targetFolder);
      console.log('Upload result:', uploadedFiles);
      
      if (uploadedFiles.length > 0) {
        console.log('Files uploaded successfully, refreshing file tree...');
        
        // Add uploaded files to checked items so they appear by default
        uploadedFiles.forEach(file => {
          this.checkedItems.add(file.path);
        });
        
        // If uploading to a folder, also ensure the folder is checked
        if (targetFolder) {
          this.checkedItems.add(targetFolder);
        }
        
        await this.loadFileTree();
        
        // Auto-show uploaded tracks
        for (const file of uploadedFiles) {
          if (this.checkedItems.has(file.path)) {
            await this.showTrack(file);
          }
        }
        
        const targetText = targetFolder ? ` to folder "${targetFolder}"` : '';
        this.showSuccess(`Uploaded ${uploadedFiles.length} GPX file(s)${targetText}`);
      } else {
        console.log('No files were uploaded (user may have cancelled)');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      this.showError('Failed to upload GPX files: ' + error.message);
    }
  }

  showCreateFolderModal() {
    const modal = document.getElementById('folderModal');
    const input = document.getElementById('folderNameInput');
    const modalTitle = modal.querySelector('h3');
    
    // Update modal title based on selection
    if (this.selectedItem && this.selectedItem.type === 'folder') {
      const folderDisplayName = this.selectedItem.path || this.selectedItem.name;
      modalTitle.textContent = `Create Folder in "${folderDisplayName}"`;
    } else {
      modalTitle.textContent = 'Create New Folder';
    }
    
    modal.classList.add('show');
    input.value = '';
    input.focus();
  }

  hideCreateFolderModal() {
    const modal = document.getElementById('folderModal');
    modal.classList.remove('show');
  }

  async createFolder() {
    const folderName = document.getElementById('folderNameInput').value.trim();
    if (!folderName) {
      this.showError('Please enter a folder name');
      return;
    }
    
    // Security: Frontend validation (backend will also validate)
    if (folderName.length > 255) {
      this.showError('Folder name too long. Maximum 255 characters.');
      return;
    }
    
    if (/[<>:"/\\|?*\x00-\x1f]/.test(folderName)) {
      this.showError('Folder name contains invalid characters. Use only letters, numbers, spaces, and basic punctuation.');
      return;
    }
    
    if (/^\.+$/.test(folderName) || folderName.includes('..')) {
      this.showError('Invalid folder name.');
      return;
    }

    try {
      // Determine parent folder
      let parentFolder = null;
      if (this.selectedItem && this.selectedItem.type === 'folder') {
        parentFolder = this.selectedItem.path || this.selectedItem.name;
      }
      
      await window.electronAPI.createFolder(folderName, parentFolder);
      await this.loadFileTree();
      this.hideCreateFolderModal();
      
      const locationText = parentFolder ? ` in "${parentFolder}"` : '';
      this.showSuccess(`Created folder: ${folderName}${locationText}`);
    } catch (error) {
      console.error('Error creating folder:', error);
      this.showError('Failed to create folder');
    }
  }

  updateTrackCount() {
    let totalTracks = this.countTracksRecursive(this.fileTree);

    const countElement = document.getElementById('trackCount');
    countElement.textContent = `${totalTracks} track${totalTracks !== 1 ? 's' : ''} available`;
  }

  countTracksRecursive(items) {
    let count = 0;
    items.forEach(item => {
      if (item.type === 'file') {
        count++;
      } else if (item.type === 'folder' && item.children) {
        count += this.countTracksRecursive(item.children);
      }
    });
    return count;
  }

  async loadSettings() {
    try {
      console.log('Loading settings...');
      this.settings = await window.electronAPI.loadSettings();
      console.log('Settings loaded:', this.settings);
    } catch (error) {
      console.error('Error loading settings, using defaults:', error);
      this.settings = {
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

  saveMapPosition() {
    if (!this.map || !this.settings) return;

    // Clear existing timeout
    if (this.saveSettingsTimeout) {
      clearTimeout(this.saveSettingsTimeout);
    }

    // Throttle saving to avoid too frequent writes
    this.saveSettingsTimeout = setTimeout(async () => {
      try {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        
        this.settings.map = {
          center: [center.lat, center.lng],
          zoom: zoom
        };

        await window.electronAPI.saveSettings(this.settings);
      } catch (error) {
        console.error('Error saving map position:', error);
      }
    }, 1000); // Save after 1 second of inactivity
  }

  showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    
    // Load current settings into modal
    const mapProvider = this.settings?.mapProvider || 'osm';
    document.getElementById('osmRadio').checked = mapProvider === 'osm';
    document.getElementById('mapyRadio').checked = mapProvider === 'mapy';
    
    document.getElementById('mapyApiKey').value = this.settings?.mapy?.apiKey || '';
    document.getElementById('mapyStyle').value = this.settings?.mapy?.style || 'basic';
    
    // Load desaturate map setting
    document.getElementById('desaturateMap').checked = this.settings?.desaturateMap || false;
    
    this.toggleMapySection();
    
    modal.classList.add('show');
  }

  hideSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
  }

  toggleMapySection() {
    const mapySection = document.getElementById('mapySection');
    const mapyRadio = document.getElementById('mapyRadio');
    
    if (mapyRadio.checked) {
      mapySection.classList.add('enabled');
    } else {
      mapySection.classList.remove('enabled');
    }
  }

  async saveSettingsFromModal() {
    try {
      const mapProvider = document.getElementById('mapyRadio').checked ? 'mapy' : 'osm';
      const mapyApiKey = document.getElementById('mapyApiKey').value.trim();
      const mapyStyle = document.getElementById('mapyStyle').value;
      const desaturateMap = document.getElementById('desaturateMap').checked;

      // Validate Mapy.cz settings if selected
      if (mapProvider === 'mapy' && !mapyApiKey) {
        this.showError('Please enter a Mapy.cz API key or select OpenStreetMap');
        return;
      }
      
      // Security: Validate API key format if provided
      if (mapyApiKey && (mapyApiKey.length < 10 || mapyApiKey.length > 200 || !/^[a-zA-Z0-9\-_]+$/.test(mapyApiKey))) {
        this.showError('Invalid API key format. Keys should be 10-200 characters with only letters, numbers, hyphens, and underscores.');
        return;
      }

      // Update settings
      this.settings.mapProvider = mapProvider;
      this.settings.mapy = {
        apiKey: mapyApiKey,
        style: mapyStyle
      };
      this.settings.desaturateMap = desaturateMap;

      // Save settings to disk
      await window.electronAPI.saveSettings(this.settings);

      // Update the map with new settings
      this.setupTileLayer();
      this.toggleMapDesaturation();

      this.hideSettingsModal();
      this.showSuccess('Settings saved successfully!');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showError('Failed to save settings: ' + error.message);
    }
  }

  async selectAllItems() {
    // Check all items and show all tracks recursively
    await this.selectAllItemsRecursive(this.fileTree);
    this.renderFileTree();
  }

  async selectAllItemsRecursive(items) {
    for (const item of items) {
      if (item.type === 'folder') {
        const folderKey = item.path || item.name;
        this.checkedItems.add(folderKey);
        if (item.children) {
          await this.selectAllItemsRecursive(item.children);
        }
      } else if (item.type === 'file') {
        this.checkedItems.add(item.path);
        if (!this.visibleTracks.has(item.path)) {
          await this.showTrack(item);
        }
      }
    }
  }

  deselectAllItems() {
    // Uncheck all items and hide all tracks
    this.checkedItems.clear();
    this.visibleTracks.forEach(trackPath => {
      const layer = this.gpxLayers.get(trackPath);
      if (layer) {
        this.map.removeLayer(layer);
      }
    });
    this.visibleTracks.clear();
    this.renderFileTree();
  }

  async deleteItem(itemToDelete) {
    const confirmMessage = itemToDelete.type === 'folder' 
      ? `Are you sure you want to delete the folder "${itemToDelete.name}" and all its contents?`
      : `Are you sure you want to delete the file "${itemToDelete.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      await window.electronAPI.deleteItem(itemToDelete);
      
      // Remove from visible tracks if it was a file
      if (itemToDelete.type === 'file') {
        this.hideTrack(itemToDelete);
        this.checkedItems.delete(itemToDelete.path);
      } else if (itemToDelete.type === 'folder') {
        // Remove all children from visible tracks
        const folderItem = this.fileTree.find(item => 
          item.type === 'folder' && item.name === itemToDelete.name
        );
        if (folderItem && folderItem.children) {
          folderItem.children.forEach(child => {
            this.hideTrack(child);
            this.checkedItems.delete(child.path);
          });
        }
        this.checkedItems.delete(itemToDelete.name);
      }

      // Clear selection if the deleted item was selected
      if (this.selectedItem && 
          ((itemToDelete.type === 'file' && this.selectedItem.path === itemToDelete.path) ||
           (itemToDelete.type === 'folder' && this.selectedItem.name === itemToDelete.name))) {
        this.clearSelection();
      }

      await this.loadFileTree();
      this.showSuccess(`Deleted ${itemToDelete.type} successfully`);
    } catch (error) {
      console.error('Error deleting item:', error);
      this.showError('Failed to delete item: ' + error.message);
    }
  }

  showError(message) {
    // Security: Don't expose internal paths or sensitive information
    const sanitizedMessage = message.replace(/\/[^\s]*\/[^\s]*/g, '[path]');
    console.error('Error (original):', message); // Keep full error in console for debugging
    alert('Error: ' + sanitizedMessage);
  }

  showSuccess(message) {
    // Simple success notification - you could enhance this with a proper notification system
    console.log(message);
    // You could add a proper notification system here
  }

  showColorPicker(folder, colorIndicator) {
    // Store current folder and color indicator for later use
    this.currentColorFolder = folder;
    this.currentColorIndicator = colorIndicator;
    
    // Update modal content
    const modal = document.getElementById('colorModal');
    const title = document.getElementById('colorModalTitle');
    const colorPicker = document.getElementById('colorPicker');
    
    title.textContent = `Choose Color for "${folder.name}"`;
    colorPicker.value = folder.color || '#FF6600';
    
    // Update preview
    this.updateColorPreview(folder.color || '#FF6600');
    
    // Show modal
    modal.classList.add('show');
  }

  hideColorModal() {
    const modal = document.getElementById('colorModal');
    modal.classList.remove('show');
    this.currentColorFolder = null;
    this.currentColorIndicator = null;
  }

  updateColorPreview(color) {
    const preview = document.getElementById('colorPreview');
    const value = document.getElementById('colorValue');
    
    preview.style.backgroundColor = color;
    value.textContent = color.toUpperCase();
  }

  async confirmColorChange() {
    if (!this.currentColorFolder || !this.currentColorIndicator) return;
    
    const colorPicker = document.getElementById('colorPicker');
    const newColor = colorPicker.value;
    
    await this.setFolderColor(this.currentColorFolder, newColor, this.currentColorIndicator);
    this.hideColorModal();
  }

  async setFolderColor(folder, color, colorIndicator) {
    try {
      const folderPath = folder.path || folder.name;
      await window.electronAPI.setFolderColor(folderPath, color);
      
      // Update the folder color in our local data (find and update in file tree)
      this.updateFolderColorInTree(this.fileTree, folderPath, color);
      
      // Update the color indicator in the UI
      colorIndicator.style.backgroundColor = color;
      
      // Refresh visible tracks to use new color immediately
      await this.refreshTracksInFolder(folder);
      
      this.showSuccess(`Updated color for folder: ${folder.name}`);
    } catch (error) {
      console.error('Error setting folder color:', error);
      this.showError('Failed to set folder color: ' + error.message);
    }
  }

  updateFolderColorInTree(items, targetPath, newColor) {
    for (const item of items) {
      if (item.type === 'folder') {
        const itemPath = item.path || item.name;
        if (itemPath === targetPath) {
          item.color = newColor;
          return true;
        }
        
        // Search recursively in children
        if (item.children && this.updateFolderColorInTree(item.children, targetPath, newColor)) {
          return true;
        }
      }
    }
    return false;
  }

  async refreshTracksInFolder(folder) {
    // Find all tracks in this folder and refresh them
    const tracksToRefresh = [];
    this.collectTracksInFolder(folder, tracksToRefresh);
    
    console.log(`Refreshing ${tracksToRefresh.length} tracks in folder "${folder.name}"`);
    
    for (const track of tracksToRefresh) {
      if (this.visibleTracks.has(track.path)) {
        console.log(`Refreshing track: ${track.name}`);
        // Remove the old layer
        if (this.gpxLayers.has(track.path)) {
          const layer = this.gpxLayers.get(track.path);
          this.map.removeLayer(layer);
          this.gpxLayers.delete(track.path);
        }
        this.visibleTracks.delete(track.path);
        
        // Re-add the track with new color
        await this.showTrack(track);
      }
    }
  }

  collectTracksInFolder(folder, trackArray) {
    if (folder.children) {
      for (const child of folder.children) {
        if (child.type === 'file') {
          trackArray.push(child);
        } else if (child.type === 'folder') {
          this.collectTracksInFolder(child, trackArray);
        }
      }
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HikingMapApp();
}); 