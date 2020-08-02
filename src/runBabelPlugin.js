const traverse = require('@babel/traverse').default
const t = require('@babel/types')
const template = require('@babel/template').default
const { parse, print } = require('recast')
var fs = require('fs')

function runBabelPlugin({ filePath, babelPlugin, options = {} }) {
  try {
    const source = fs.readFileSync(filePath, { encoding: 'utf8' })
    // console.log(`Code source loaded (${source.length} characters)`)
    // console.log('Source:', source)
    const ast = parse(source, {
      parser: require('recast/parsers/babel'),
    })
    traverse(ast, babelPlugin({ types: t, template }, options).visitor)
    const { code: output } = print(ast)
    // console.log('\n\n-------------\n')
    // console.log('[Output]\n\n')
    if (output === source) {
      console.log('   -> No changes for this file')
    } else {
      console.log('   -> Changes applied')
    }
    if (options.isDryRun !== true) {
      fs.writeFileSync(filePath, output, { encoding: 'utf8' })
    }
    // console.log('Plugin applied successfully')
    // console.log(`Output source: ${output.length} characters`)

    // console.log(output)
  } catch (e) {
    console.log(e)
  }
}

module.exports = runBabelPlugin
