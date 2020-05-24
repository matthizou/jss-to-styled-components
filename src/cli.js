#!/usr/bin/env node

const pathLib = require('path')
const { EOL } = require('os')
const runBabelPlugin = require('./runBabelPlugin')
const jssToStyledComponent = require('./babel-plugin-jss-to-styled-components')

function displayHelp() {
  console.log(`${EOL}Usage: -f filePath`)
}

const ARGUMENTS = process.argv.slice(2)

;(function () {
  if (ARGUMENTS.includes('-h')) {
    displayHelp()
    return false
  }

  let filename
  try {
    ARGUMENTS.filter((value) => value.startsWith('-')).forEach((arg) => {
      switch (arg.toLowerCase()) {
        case '-f':
          filename = getArgumentValue(arg)
          break
      }
    })
  } catch (e) {
    console.error(e.toString())
    displayHelp()
    return false
  }
  if (!filename) {
    console.log('Missing filename')
    displayHelp()
    return false
  }

  const cwd = process.cwd()
  const filePath = pathLib.resolve(cwd, filename)
  runBabelPlugin(filePath, jssToStyledComponent)
})()

function getArgumentValue(optionName) {
  const index = ARGUMENTS.indexOf(optionName)
  if (index === ARGUMENTS.length - 1 || ARGUMENTS[index + 1].startsWith('-')) {
    throw new Error(`Missing value for option:${optionName}`)
  }
  return ARGUMENTS[index + 1]
}
