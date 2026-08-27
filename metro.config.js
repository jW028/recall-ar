const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

// The admin dashboard is a separate Vite app that happens to live in this repo. Metro walks the whole
// project root, and admin/node_modules holds its own copy of React — without this the resolver can
// pick that copy up and the app fails at runtime with two React instances.
config.resolver.blockList = [
    ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
    new RegExp(`^${path.resolve(__dirname, 'admin').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*$`),
];

module.exports = config;
