// const { looksLike } = require('./utils/looksLike');
const { toKebabCase } = require('./utils/toKebabCase')
const { print } = require('recast')

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

            const { componentName, tag = 'div' } =
              jssMappings.get(jssClass) || {}
            if (!componentName) return

            const generatedCss = getStyledComponentCss({
              cssClasses,
              composeNode,
            })
            // console.log('😺 generatedCss:', generatedCss)

            const isHTMLTag = /^[a-z]/.test(tag)
            const componentDeclaration = template.ast(
              `const ${componentName} = styled${
                isHTMLTag ? `.${tag}` : `(${tag})`
              }${
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
        const { name: nameNode, value: valueNode = {} } = path.node
        const { expression = {} } = valueNode
        // name / value
        if (nameNode.name === 'className') {
          const { cssConcatenationFunctions = [] } = options
          let componentName, propertyName
          let removeAttribute = false
          if (expression.type === 'CallExpression') {
            const { callee } = expression
            if (cssConcatenationFunctions.includes(callee.name)) {
              // i.e: cn("mt6",classes.container, "mb0")
              const jsxBinding = expression.arguments.find(isJsxBinding)
              propertyName = jsxBinding.property.name
              componentName = generateComponentNameFromJssClassname({
                name: propertyName,
                path,
              })
              expression.arguments = expression.arguments.filter(
                argument => argument !== jsxBinding
              )
              if (expression.arguments.length === 0) {
                removeAttribute = true
              }
              if (expression.arguments.length === 1) {
                path.node.value = expression.arguments[0]
              }
            }
          } else {
            if (!isJsxBinding(expression)) return
            propertyName = expression.property.name
            componentName = generateComponentNameFromJssClassname({
              name: expression.property.name,
              path,
            })
            removeAttribute = true
          }
          if (!componentName) return

          const jsxElement = path.findParent(
            path => path.node.type === 'JSXElement'
          )
          const { openingElement, closingElement } = jsxElement.node
          const tag = openingElement.name.name
          openingElement.name.name = componentName
          closingElement.name.name = componentName

          if (removeAttribute) {
            path.remove()
          }

          // todo: check if it already exists. If yes, compare tag.
          // If different, change componentName
          const jssMapping = jssMappings.get(propertyName)
          if (!jssMapping) {
            jssMappings.set(propertyName, { tag, componentName })
          } else if (jssMapping.tag !== tag) {
            console.log('🐞 Different tag detected:', tag)
            const isHTMLTag = /^[a-z]/.test(tag)
            if (isHTMLTag) {
              openingElement.attributes.push(
                t.jsxAttribute(t.jsxIdentifier('as'), t.stringLiteral(tag))
              )
            } else {
              openingElement.attributes.push(
                t.jsxAttribute(
                  t.jsxIdentifier('as'),
                  t.jsxExpressionContainer(t.identifier(tag))
                )
              )
            }
          }
        }
      },
    },
  }
}

function getStyledComponentCss({ cssClasses, composeNode }) {
  const generatedCss = cssClasses
    .filter(node => node !== composeNode)
    .map(({ key: keyNode, value: valueNode }) => {
      // todo: key.computed? ===> [someProp]
      let name
      if (keyNode.type === 'Identifier') {
        name = toKebabCase(keyNode.name)
      } else {
        name = keyNode.value
      }

      let value = valueNode.value
      if (valueNode.type === 'ObjectExpression') {
        value = `
          ${getStyledComponentCss({
            cssClasses: valueNode.properties,
            composeNode,
          }).join(';\n  ')}
        `
        return `${name} {
          ${value}
        }`
      } else if (isStringNode(valueNode)) {
        value = valueNode.value
      } else if (valueNode.type === 'Identifier') {
        value = `$\{${valueNode.name}}`
      } else if (valueNode.type === 'NumericLiteral') {
        const NON_PIXELS_PROPERTIES = [
          'font-weight',
          'flex',
          'flex-shrink',
          'flex-grow',
          'z-index',
          'order',
          'tab-size',
        ]
        if (valueNode.value === 0) {
          value = 0
        } else if (NON_PIXELS_PROPERTIES.includes(name)) {
          value = valueNode.value
        } else {
          value = `${valueNode.value}px`
        }
      } else {
        // i.e: CallExpression
        value = `$\{${print(valueNode).code}}` //print(valueNode)
      }
      return `${name}: ${value}`
    })

  return generatedCss
}

function removeCompose({ node, parent, t, options }) {
  const { value: cssClasses } = node.value
  const { findCss } = options
  const unknownCss = []
  // console.log('Compose 🐬')

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

function isStringNode(node) {
  const { type } = node
  return type === 'StringLiteral' || type === 'Literal'
}

function isJsxBinding(node) {
  const { type, object } = node
  return type === 'MemberExpression' && object.name === INJECTED_JSS_PROP
}

function generateComponentNameFromJssClassname({ name, path }) {
  if (!name) return
  // if (expression.type !== 'MemberExpression') return
  // if (object.name !== INJECTED_JSS_PROP) return
  let componentName = `${name[0].toUpperCase()}${name.slice(1)}`
  if (path.scope.hasBinding(componentName)) {
    // Backup name. As much as possible, we want to avoid Babel generating a name for us,
    // as they don't look good.
    if (path.scope.hasBinding(componentName + 'Styled')) {
      componentName = path.scope.generateUidIdentifier(componentName)
    } else {
      componentName += 'Styled'
    }
  }
  return componentName
}
