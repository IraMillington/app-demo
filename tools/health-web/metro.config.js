// Demo web build only: swaps phone-only native modules for web stand-ins.
// The app's own source files are untouched.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const STUBS = {
  'expo-notifications': 'notifications.js',
  'expo-image-picker': 'image-picker.js',
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && STUBS[moduleName] && !context.originModulePath.includes(`${path.sep}demo-stubs${path.sep}`)) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'demo-stubs', STUBS[moduleName]) };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
