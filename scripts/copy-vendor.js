#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

async function copyVendorDependencies() {
  try {
    console.log('Copying vendor dependencies...');
    
    // Ensure vendor directory exists
    const vendorDir = path.join(__dirname, '..', 'src', 'vendor');
    await fs.mkdir(vendorDir, { recursive: true });
    
    // Copy Leaflet
    const leafletSrc = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
    const leafletDest = path.join(vendorDir, 'leaflet');
    
    await fs.mkdir(leafletDest, { recursive: true });
    await fs.copyFile(path.join(leafletSrc, 'leaflet.css'), path.join(leafletDest, 'leaflet.css'));
    await fs.copyFile(path.join(leafletSrc, 'leaflet.js'), path.join(leafletDest, 'leaflet.js'));
    await fs.cp(path.join(leafletSrc, 'images'), path.join(leafletDest, 'images'), { recursive: true });
    
    console.log('✅ Vendor dependencies copied successfully');
  } catch (error) {
    console.error('❌ Error copying vendor dependencies:', error);
    process.exit(1);
  }
}

copyVendorDependencies(); 