#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function copyVendorDependencies() {
  try {
    console.log('Copying vendor dependencies...');
    
    // Ensure vendor directory exists
    const vendorDir = path.join(__dirname, '..', 'src', 'vendor');
    await fs.ensureDir(vendorDir);
    
    // Copy Leaflet
    const leafletSrc = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
    const leafletDest = path.join(vendorDir, 'leaflet');
    
    await fs.ensureDir(leafletDest);
    await fs.copy(path.join(leafletSrc, 'leaflet.css'), path.join(leafletDest, 'leaflet.css'));
    await fs.copy(path.join(leafletSrc, 'leaflet.js'), path.join(leafletDest, 'leaflet.js'));
    await fs.copy(path.join(leafletSrc, 'images'), path.join(leafletDest, 'images'));
    
    console.log('✅ Vendor dependencies copied successfully');
  } catch (error) {
    console.error('❌ Error copying vendor dependencies:', error);
    process.exit(1);
  }
}

copyVendorDependencies(); 