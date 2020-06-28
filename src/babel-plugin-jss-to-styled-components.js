// const { looksLike } = require('./utils/looksLike');
const { toKebabCase } = require('./utils/toKebabCase')

const INJECTED_JSS_PROP = 'classes'

module.exports = function (babel, options = {}) {
  const { types: t, template } = babel
  let styleDeclaration
  let jssMappings = new Map()

  return {
    name: 'jss-to-styled-component', // not required
    visitor: {
      Program: {
        enter(path) {
          const jssImport = path.node.body
            .filter(node => node.type === 'ImportDeclaration')
            .map(node => node.source.value.trim())
            .find(importName => importName === 'react-jss')
          if (!jssImport) return

          styleDeclaration = path.node.body
            .filter(node => node.type === 'VariableDeclaration')
            //            .map((node) => node.declarations[0])
            .find(
              ({ declarations }) =>
                declarations[0].id.name === 'styles' &&
                declarations[0].init.type === 'ObjectExpression'
            )
        },

        exit(path) {
          if (!styleDeclaration) return

          const jssClassnames = styleDeclaration.declarations[0].init.properties
          const jssStyleNodeIndex = path.node.body.indexOf(styleDeclaration) + 1
          jssClassnames.forEach((jssProperty, index) => {
            const {
              key: { name: jssClass },
              value: { properties: cssClasses },
            } = jssProperty

            // === Handling `composes` - START
            const composeNode = cssClasses.find(
              node => node.key.name === 'composes'
            )
            if (
              composeNode &&
              (t.isStringLiteral(composeNode.value) ||
                composeNode.value.type === 'Literal')
            ) {
              removeCompose({
                node: composeNode,
                parent: jssProperty,
                t,
                options,
              })
            }
            // === Handling `composes` - END

            const generatedCss = cssClasses
              .filter(node => node !== composeNode)
              .map(
                ({ key, value }) => `${toKebabCase(key.name)}: ${value.value}`
              )

            const mappingData = jssMappings.get(jssClass)
            if (!mappingData) return

            const componentDeclaration = template.ast(
              `const ${mappingData.componentName} = styled.${mappingData.tag}${
                composeNode
                  ? `.attrs({ className: "${composeNode.value.value}"})`
                  : ''
              }\`\n  ${generatedCss.join(';\n  ')}\n\``
            )

            const topLevelNodes = path.node.body
            path.node.body = [
              ...topLevelNodes.slice(0, jssStyleNodeIndex + index),
              componentDeclaration,
              ...topLevelNodes.slice(jssStyleNodeIndex + index),
            ]
          })
          path.node.body = [
            ...path.node.body.slice(0, jssStyleNodeIndex - 1),
            ...path.node.body.slice(jssStyleNodeIndex),
          ]
        },
      },

      JSXAttribute(path) {
        const { name: nameNode, value: valueNode } = path.node
        // name / value
        if (nameNode.name === 'className') {
          if (valueNode.expression.type !== 'MemberExpression') return
          const { object, property } = valueNode.expression
          if (object.name !== INJECTED_JSS_PROP) return
          let componentName = `${property.name[0].toUpperCase()}${property.name.slice(
            1
          )}`
          if (path.scope.hasBinding(componentName)) {
            // Backup name. As much as possible, we want to avoid Babel generating a name for us,
            // as they don't look good.
            if (path.scope.hasBinding(componentName + 'Styled')) {
              componentName = path.scope.generateUidIdentifier(componentName)
            } else {
              componentName += 'Styled'
            }
          }
          // console.log(componentName)

          const jsxElement = path.findParent(
            path => path.node.type === 'JSXElement'
          )
          const { openingElement, closingElement } = jsxElement.node
          //console.log(openingElement);
          const tag = openingElement.name.name
          openingElement.name.name = componentName
          closingElement.name.name = componentName

          path.remove()
          jssMappings.set(property.name, { tag, componentName })
        }
      },
    },
  }
}

function removeCompose({ node, parent, t, options }) {
  const { value: cssClasses } = node.value
  const { findCss } = options
  const unknownCss = []
  console.log('Compose 🐬')

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
