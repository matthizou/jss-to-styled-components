// babel.config.js
module.exports = {
  plugins: ['@babel/syntax-jsx'],
  parserOpts: {
    parser: 'recast',
  },
  generatorOpts: {
    generator: 'recast',
  },
}
