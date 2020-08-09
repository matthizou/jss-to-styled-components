const fs = require('fs')
const pathLib = require('path')

const IGNORED_FOLDERS = [
  'node_modules',
  '.git',
  'tmp',
  'temp',
  'public',
  'bower_components',
]

function walkRecur(fullPath, options = {}, results = []) {
  try {
    const stat = fs.statSync(fullPath)
    const isDirectory = stat.isDirectory()
    let name

    // DIRECTORY
    if (isDirectory) {
      name = pathLib.basename(fullPath)
      if (IGNORED_FOLDERS.includes(name)) {
        return results
      }
      // Continue recursion
      const children = fs.readdirSync(fullPath)

      children.map(childName =>
        walkRecur(pathLib.join(fullPath, childName), options, results)
      )
    } else {
      // FILE
      const extension = pathLib.extname(fullPath).toLowerCase()
      if (options.extensions && !options.extensions.includes(extension)) {
        return results
      }
      results.push(fullPath)
    }
    return results
  } catch (ex) {
    console.error(`walkRecur() error when processing: ${fullPath}`)
    console.error(`${ex.message}`)
    return
  }
}

/**
 *
 * @param {string} path
 * @param {Object} options
 * @param {Array} options.extensions
 * @param {Array} options.ignoredFolders
 */
function getFiles(path, { ignoredFolders = IGNORED_FOLDERS, extensions } = {}) {
  const results = []
  walkRecur(
    path,
    {
      ignoredFolders,
      extensions,
    },
    results
  )
  return results
}

module.exports = {
  getFiles,
}
