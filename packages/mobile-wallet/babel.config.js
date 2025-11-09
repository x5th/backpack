module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          crypto: 'crypto-browserify',
          stream: 'stream-browserify',
          buffer: 'buffer',
        },
      },
    ],
  ],
};
