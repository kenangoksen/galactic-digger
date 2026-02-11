const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v9+ / v10+ fix for Expo
config.resolver.sourceExts.push('cjs');

module.exports = config;
