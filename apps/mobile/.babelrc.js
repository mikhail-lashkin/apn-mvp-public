module.exports = function(api) {
  api.cache(true);
  
  const isTest = process.env.NODE_ENV === 'test';
  
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
      !isTest && 'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};