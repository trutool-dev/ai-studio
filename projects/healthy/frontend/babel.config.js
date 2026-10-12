module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', worklets: false }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
          alias: {
            '@':           './src',
            '@screens':    './src/screens',
            '@components': './src/components',
            '@stores':     './src/stores',
            '@services':   './src/services',
            '@theme':      './src/theme',
            '@navigation': './src/navigation',
          },
        },
      ],
    ],
  };
};
