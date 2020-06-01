#!/usr/bin/env node

const pathLib = require('path')
const { EOL } = require('os')
const runBabelPlugin = require('./runBabelPlugin')
const jssToStyledComponent = require('./babel-plugin-jss-to-styled-components')
const { processCss } = require('./processCss')
const { getFiles } = require('./utils/walkRecur')
var glob = require('glob')

function displayHelp() {
  console.log(`${EOL}Usage:
   -f filePath        
   -d directoryPath   
   -css cssFilePath   
   --dry-run          
   `)
}

function getDirectoryFiles(path) {
  return new Promise(resolve => {
    glob(`./tests/**/*.js`, {}, function (er, files) {
      resolve(files)
      // files is an array of filenames.
      // If the `nonull` option is set, and nothing
      // was found, then files is ["**/*.js"]
      // er is an error object or null.
    })
  })
}

const ARGUMENTS = process.argv.slice(2)

;(async function () {
  if (ARGUMENTS.includes('-h') || ARGUMENTS.includes('--help')) {
    displayHelp()
    return false
  }

  let filePath, dirPath, cssPath, findCss
  let isDryRun = false
  try {
    ARGUMENTS.filter(value => value.startsWith('-')).forEach(arg => {
      switch (arg.toLowerCase()) {
        case '-css':
          cssPath = getArgumentValue(arg)
          break
        case '-f':
          filePath = getArgumentValue(arg)
          break
        case '-d':
          dirPath = getArgumentValue(arg)
          break
        case '--dry-run':
          isDryRun = true
          break
      }
    })
  } catch (e) {
    console.error(e.toString())
    displayHelp()
    return false
  }
  if (!filePath && !dirPath) {
    console.log('Missing filename or directory path')
    displayHelp()
    return false
  }

  let files = []
  if (dirPath) {
    files = getFiles(dirPath)
  }
  if (filePath) {
    files.push(filePath)
  }

  if (cssPath) {
    findCss = processCss({ filePath: cssPath }).findCss
  }

  const cwd = process.cwd()
  files.forEach(path => {
    console.log(pathLib.resolve(cwd, path))
    runBabelPlugin({
      filePath: pathLib.resolve(cwd, path),
      babelPlugin: jssToStyledComponent,
      options: { findCss, isDryRun },
    })
  })
})()

function getArgumentValue(optionName) {
  const index = ARGUMENTS.indexOf(optionName)
  if (index === ARGUMENTS.length - 1 || ARGUMENTS[index + 1].startsWith('-')) {
    throw new Error(`Missing value for option:${optionName}`)
  }
  return ARGUMENTS[index + 1]
}
