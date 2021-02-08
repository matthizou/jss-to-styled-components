const pluginTester = require('babel-plugin-tester').default
const jssToStyledComponentsPlugin = require('./babel-plugin-jss-to-styled-components')
const { processCss } = require('./processCss')

const findCss = processCss({ filePath: './assets/360-mini.css' }).findCss

// return
pluginTester({
  pluginName: 'jssToStyledComponentsPlugin',
  plugin: jssToStyledComponentsPlugin,
  babelOptions: require('../babel.config.js'),
  snapshot: true,
  tests: [
    // Use of template literal syntax in jsx classes
    {
      code: `
      import injectSheet from 'react-jss'
      const color = '#EEE'
      const styles = {
        container: {
            marginTop: "12px",
            borderTop: \`1px solid $\{color}\`,
            marginBottom: "-24px",
          },
      }

      const HeaderFooterCard = ({ classes }) => (
        <section className={classes.container}>🥝 Object values</section>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
  ],
})
