const traverse = require('@babel/traverse').default
const t = require('@babel/types')
const { parse, print } = require('recast')
var fs = require('fs')

function runBabelPlugin(filePath, babelPlugin) {
  try {
    const source = fs.readFileSync(filePath, { encoding: 'utf8' })
    console.log(`Code source loaded (${source.length} characters)`)
    // console.log('Source:', source)
    const ast = parse(source)
    traverse(ast, babelPlugin({ types: t }).visitor)
    const { code: output } = print(ast)
    // console.log('\n\n-------------\n')
    // console.log('[Output]\n\n')
    fs.writeFileSync(filePath, output, { encoding: 'utf8' })
    console.log('Plugin applied successfully')
    console.log(`Output source: ${output.length} characters`)

    // console.log(output)
  } catch (e) {
    console.log(e)
  }
}

module.exports = runBabelPlugin
