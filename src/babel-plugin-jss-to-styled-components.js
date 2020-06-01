// const { looksLike } = require('./utils/looksLike');

// const atomicCss = {
//   ".py16": [
//     ["paddingTop", "16px"],
//     ["paddingBottom", "16px"]
//   ],
//   ".px24": [
//     ["paddingLeft", "24px"],
//     ["paddingRight", "24px"]
//   ],
//   ".background-gray-5": [["background", "#808080"]],
//   ".mb16": [["marginBottom", "16px"]]
// };

module.exports = function (babel, options = {}) {
  const { types: t } = babel
  return {
    name: 'jss-to-styled-component', // not required
    visitor: {
      Program(path) {
        const jssImport = path.node.body
          .filter(node => node.type === 'ImportDeclaration')
          .map(node => node.source.value.trim())
          .find(importName => importName === 'react-jss')
        if (!jssImport) return
        const styleDeclaration = path.node.body
          .filter(node => node.type === 'VariableDeclaration')
          .map(node => node.declarations[0])
          .find(
            node =>
              node.id.name === 'styles' && node.init.type === 'ObjectExpression'
          )

        if (!styleDeclaration) return

        const jssClassnames = styleDeclaration.init.properties
        // console.log(jssClassnames)

        jssClassnames.forEach(node => {
          // console.log(node.key.name)
          const cssClasses = node.value.properties
          const compose = cssClasses.find(node => node.key.name === 'composes')
          // console.log('😺', compose)
          // console.log('😺', cssClasses.map(x => x.key.name).join(','))
          if (compose && compose.value.type === 'Literal') {
            removeCompose({
              node: compose,
              parent: node,
              t,
              options,
            })
          }
        })
      },
    },
  }
}

function removeCompose({ node, parent, t, options }) {
  const { value: cssClasses } = node.value
  const { findCss } = options
  const unknownCss = []
  cssClasses.split(' ').forEach(cssClass => {
    const rules = findCss(`.${cssClass}`)
    if (rules) {
      //
      rules.forEach(rule => {
        const [name, value] = rule
        const newProperty = t.objectProperty(
          t.identifier(name),
          t.stringLiteral(value)
        )
        parent.value.properties.push(newProperty)
      })
    } else {
      unknownCss.push(cssClass)
    }
  })
  if (!unknownCss.length) {
    // Remove compose property
    parent.value.properties = parent.value.properties.filter(
      property => property !== node
    )
  } else {
    node.value.value = unknownCss.join(' ')
  }
}
