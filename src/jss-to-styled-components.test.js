const pluginTester = require('babel-plugin-tester').default
// const identifierReversePlugin = function () {
//   return {
//     visitor: {
//       Identifier(idPath) {
//         idPath.node.name = idPath.node.name.split('').reverse().join('')
//       },
//     },
//   }
// }

const jssToStyledComponentsPlugin = require('./babel-plugin-jss-to-styled-components')
const { processCss } = require('./processCss')

// .default

const findCss = processCss({ filePath: './assets/360-mini.css' }).findCss

// return
pluginTester({
  pluginName: 'jssToStyledComponentsPlugin',
  plugin: jssToStyledComponentsPlugin,
  babelOptions: require('../babel.config.js'),
  snapshot: true,
  tests: [
    {
      code: `
      import injectSheet from 'react-jss'

      const styles = {
        card: {
          borderTopStyle: 'solid',
          borderTopWidth: '1px',
          borderColor: '#d1d1d1',
        },
        container: {
          composes: 'cssClass1 cssClass2',
          marginTop: '8px',
        },
      }

      const HeaderFooterCard = ({ id, className, classes, footer }) => (
        <section className={classes.container}>
          <div className={classes.card} data-testid="broccoli">🥦</div>
          <div className={cn(classes.card, "mb0")}>🍅</div>
        </section>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
  ],
})
