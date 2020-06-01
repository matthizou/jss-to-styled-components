const { looksLike } = require('./utils/looksLike')

module.exports = function (babel) {
  const { types: t } = babel
  return {
    name: 'node-esmodule', // not required
    visitor: {
      CallExpression(path) {
        const { node } = path
        const { callee, arguments: args } = node
        if (
          looksLike(callee, {
            type: 'MemberExpression',
            object: {
              name: 'console',
            },
            property: {
              name: 'log',
            },
          })
        ) {
          args.unshift(t.stringLiteral('HEY !'))
        }
      },
    },
  }
}
