module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@apn/core': '../../packages/core/src',
            '@': './',
          },
        },
      ],
    ],
  };
};
