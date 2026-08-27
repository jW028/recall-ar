const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

// Combine block list entries:
// 1. The admin dashboard is a separate Vite app that happens to live in this repo. Metro walks the whole
// project root, and admin/node_modules holds its own copy of React — without this the resolver can
// pick that copy up and the app fails at runtime with two React instances.
// 2. Ignore native Gradle and Android build output directories from Metro file watcher to prevent ENOENT watcher errors
const existingBlockList = Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [
    ...existingBlockList,
    new RegExp(`^${path.resolve(__dirname, 'admin').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*$`),
    /.*[\\/]android[\\/].*[\\/]build[\\/].*/,
    /.*[\\/]build[\\/]classes[\\/].*/,
    /.*[\\/]\.gradle[\\/].*/,
];

module.exports = config;
