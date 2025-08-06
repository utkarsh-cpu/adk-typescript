const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  resolver: {
    alias: {
      '@': './src',
      '@/agents': './src/agents',
      '@/tools': './src/tools',
      '@/models': './src/models',
      '@/flows': './src/flows',
      '@/memory': './src/memory',
      '@/sessions': './src/sessions',
      '@/artifacts': './src/artifacts',
      '@/auth': './src/auth',
      '@/events': './src/events',
      '@/errors': './src/errors',
      '@/utils': './src/utils',
      '@/react-native': './src/react-native',
    },
    sourceExts: ['js', 'json', 'ts', 'tsx'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  serializer: {
    getModulesRunBeforeMainModule: () => [
      require.resolve('react-native/Libraries/Core/InitializeCore'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);