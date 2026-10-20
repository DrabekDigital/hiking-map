// Small subset of fs-extra helpers implemented on top of node:fs/promises
const fs = require('node:fs/promises');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

async function writeJson(filePath, data, { spaces } = {}) {
  await fs.writeFile(filePath, JSON.stringify(data, null, spaces) + '\n', 'utf-8');
}

async function copy(src, dest) {
  await fs.cp(src, dest, { recursive: true });
}

async function remove(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

module.exports = {
  ...fs,
  ensureDir,
  pathExists,
  readJson,
  writeJson,
  copy,
  remove
};
