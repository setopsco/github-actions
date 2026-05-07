const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
  target: 'node',
  resolve: {
    conditionNames: ['require', 'node', 'import', 'default'],
  },
};
