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
    // Smoke test with a complex scenario combining most of the scenarios from below
    {
      code: `
      import injectSheet from 'react-jss'
      import { color } from "@xingternal/360-styles/helpers"
      const CARD_WIDTH = 240

      const styles = {
        card: {
          borderTopStyle: 'solid',
          borderColor: '#d1d1d1',
          width: CARD_WIDTH,
          '&:hover': {
            textDecoration: 'none'
          }
        },
        container: {
          composes: 'cssClass1 cssClass2',
          marginTop: 8,
          color: color('gray-60'),
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
        cssConcatenationFunctions: ['cn'],
      },
    },
    // Use of number values in jsx classes
    {
      code: `
      import injectSheet from 'react-jss'

      const styles = {
        container: {
          marginTop: 8,
          padding: 4,
          left: 100,
          fontWeight: 400,
          zIndex: 10,
          flex: 1,
        },
      }

      const HeaderFooterCard = ({ classes }) => (
        <section className={classes.container}>🍊 Numeric values</section>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
    // Use of variables & functions in jsx classes
    {
      code: `
      import injectSheet from 'react-jss'
      import { color } from '@xingternal/360-styles/helpers'
      const CARD_WIDTH = '240px'

      const styles = {
        container: {
          color: color('gray-60'),
          width: CARD_WIDTH,
        },
      }

      const HeaderFooterCard = ({ classes }) => (
        <section className={classes.container}>🍓 Computed values</section>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
    // Use of "&" syntax in jsx classes
    {
      code: `
      import injectSheet from 'react-jss'

      const styles = {
        container: {
          '&:hover': {
            textDecoration: 'none',
            paddingTop:  4,
          }
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
    // Class contenation function
    {
      code: `
      import injectSheet from 'react-jss'
      import cn from "classnames"

      const styles = {
        card: {
          marginLeft: 'auto',
          marginRight: 'auto',
        },
      }

      const HeaderFooterCard = ({ classes }) => (
        <div>
          <div className={cn(classes.card)}>🍌</div>
          <div className={cn("margin-top-10",classes.card)}>🍌🍌</div>
          <div className={cn("margin-top-10","padding-4", classes.card)}>🍌🍌🍌</div>
        </div>
      )
    `,
      pluginOptions: {
        findCss,
        cssConcatenationFunctions: ['cn'],
      },
    },
    // React element using jss class
    // ==> styled(ReactComponent)`.....`
    {
      code: `
      import injectSheet from 'react-jss'

      const styles = {
        card: {
          padding: 4,
        },
      }

      const HeaderFooterCard = ({ classes }) => (
        <div>
          <Text className={classes.card}>🍇</Text>
        </div>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
    // Use of "as"
    // Multiple elements using the same jsx class, with different tags/elements
    {
      code: `
      import injectSheet from 'react-jss'

      const styles = {
        card: {
          padding: 4,
        },
      }

      const HeaderFooterCard = ({ classes }) => (
        <div>
          <span className={classes.card}>🍍</span>
          <div className={classes.card}>🥥</div>
          <span className={classes.card}>🍍</span>
          <Text className={classes.card}>🥥</Text>
        </div>
      )
    `,
      pluginOptions: {
        findCss,
      },
    },
  ],
})
