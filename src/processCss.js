// const ARGUMENTS = process.argv.slice(2);
const fs = require('fs')
// const pathLib = require('path');
var css = require('css')

// if (!ARGUMENTS.length) {
//   console.log(`Usage: Specify filename as first argument`);
// }

const snakeToCamel = str => str.replace(/([-_]\w)/g, g => g[1].toUpperCase())

// const filename = ARGUMENTS[0];
// const cwd = process.cwd();
// const filePath = pathLib.resolve(cwd, filename);

const processCss = ({ filePath }) => {
  const synomyms = {}
  const output = {}
  try {
    const source = fs.readFileSync(filePath, 'utf8')
    var obj = css.parse(source, { source })

    const { rules } = obj.stylesheet
    rules.forEach(({ selectors, declarations }) => {
      selectors.forEach((selector, index) => {
        if (index === 0) {
          output[selector] = declarations.map(({ property, value }) => [
            property.startsWith('-') ? property : snakeToCamel(property),
            value,
          ])
        } else {
          synomyms[selector] = selectors[0]
        }
      })
    })

    console.log(`
-----------
 CSS file: ${filePath}
 Classes found: ${Object.keys(output).length}
-----------
    `)
    // console.log(obj.stylesheet.rules[0])
    // console.log('output:', output)
    // console.log('synonyms:', synomyms)
    return {
      findCss: cssSelector => {
        const selector = synomyms[cssSelector] || cssSelector
        return output[selector]
      },
      size: output.length,
    }
  } catch (e) {
    console.log(e)
  }
}

module.exports = {
  processCss,
}
