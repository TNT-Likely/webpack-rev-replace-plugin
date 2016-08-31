var path = require('path')
var fs = require('fs')
var vm = require('vm')
var glob = require('glob')
var Promise = require('bluebird')
var _ = require('lodash')

var webpack = require('webpack')
var NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin')
var NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')
var LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin')
  // var LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin')
var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin')

/**
 * @class RevReplacePlugin
 * replace links in webpages
 * @param {Object} opts
 */
function RevReplacePlugin(opts) {
  opts.cwd = path.resolve(opts.cwd)
  this.opts = _.assign({}, opts || {})
}

/**
 * plugin hook method
 * @param  {Compiler} compiler
 */
RevReplacePlugin.prototype.apply = function(compiler) {
  var self = this
  this.result = []
  this.context = compiler.context

  compiler.plugin('make', function(compilation, callback) {
    var files = glob.sync(self.opts.files, { cwd: self.opts.cwd })

    files = files.map(function(file) {
      var outputFilename = file
      var filePath = path.join(self.opts.cwd, file)
      if (self.opts.outputPageName)
        outputFilename = self.opts.outputPageName(outputFilename)

      return self.compilePage(filePath, outputFilename, compilation)
    })

    Promise.all(files)
      .then(function(result) { self.result = result })
      .catch(function(err) {
        return new Error(err)
      })
      .finally(callback)
  })

  compiler.plugin('emit', function(compilation, callback) {
    var assets = self.getAssets(compilation)

    var promises = self.result.map(function(item) {

      return self.execPage(compilation, item)
    })

    Promise.all(promises)
      .then(function(contents) {
        contents.forEach(function(content, idx) {
          html = self.replacePageAssets(content.html, assets)
          compilation.assets[content.filename] = self.buildPageAsset(html)
        })
      })
      .catch(function(err) {
        return new Error(err)
      })
      .finally(callback)
  })
}

/**
 * get comipler name for page asset
 * @param  {string} filePath
 * @return {string}
 */
RevReplacePlugin.prototype.getCompilerName = function(filePath) {
  var relativePath = path.relative(this.context, filePath)
  return 'page-webpack-plugin for "' + (filePath.length < relativePath.length ? filePath : relativePath) + '"'
}

/**
 * compile page
 * @param  {string} page
 * @param  {string} outputFilename
 * @param  {Compilation} compilation
 * @return {Promise}
 */
RevReplacePlugin.prototype.compilePage = function(page, outputFilename, compilation) {
  var outputOptions = {
    filename: outputFilename,
    publicPath: compilation.outputOptions.publicPath
  }

  if (this.opts.entryName) outputOptions.filename = this.opts.entryName(outputFilename)

  var compilerName = this.getCompilerName(page)
  var childCompiler = compilation.createChildCompiler(compilerName, outputOptions)

  childCompiler.apply(
    new NodeTemplatePlugin(outputOptions),
    new NodeTargetPlugin(),
    // new LibraryTemplatePlugin('PAGE_WEBPACK_PLUGIN_RESULT', 'var'),
    new SingleEntryPlugin(this.context, page),
    new LoaderTargetPlugin('node')
    // new webpack.DefinePlugin({ PAGE_WEBPACK_PLUGIN: 'true' })
  )

  childCompiler.plugin('compilation', function(compilation) {
    if (compilation.cache) {
      if (!compilation.cache[compilerName]) {
        compilation.cache[compilerName] = {}
      }
      compilation.cache = compilation.cache[compilerName]
    }
  })

  return new Promise(function(resolve, reject) {
    childCompiler.runAsChild(function(err, entries, childCompilation) {
      if (childCompilation.errors && childCompilation.errors.length) {
        var errorDetails = childCompilation.errors.map(function(err) {
          return err.message + (err.error ? ':\n' + err.error : '')
        }).join('\n')

        reject('Child compilation failed:\n' + errorDetails)
      } else {
        resolve({
          filename: outputOptions.filename,
          asset: compilation.assets[outputOptions.filename]
        })
      }
    })
  })
}

/**
 * execute page asset
 * @param  {Comilaition} compilation
 * @param  {object} compilationResult
 * @return {Promise Object}
 */
RevReplacePlugin.prototype.execPage = function(compilation, compilationResult) {
  if (!compilationResult)
    return Promise.reject('The child compilation didn\'t provide a result')

  var newSource
  var source = compilationResult.asset.source()
    // source = source.replace('var PAGE_WEBPACK_PLUGIN_RESULT =', '')
  try {
    newSource = vm.runInThisContext(source)
  } catch (e) {
    var syntaxError = require('syntax-error')(source)
    var errorMessage = 'Page compilation failed: ' + e +
      (syntaxError ? '\n' + syntaxError + '\n\n\n' + source.split('\n').map(function(row, i) {
        return (1 + i) + '  - ' + row
      }).join('\n') : '')

    compilation.errors.push(new Error(errorMessage))

    return Promise.reject(e)
  }

  return (typeof newSource === 'string' || typeof newSource === 'function') ? Promise.resolve({ filename: compilationResult.filename, html: newSource }) : Promise.reject('The loader "' + compilationResult.filename + '" didn\'t return html.')
}

/**
 * build html content as a webpack asset
 * @param  {string} html
 * @return {object}
 */
RevReplacePlugin.prototype.buildPageAsset = function(html) {
  return {
    source: function() {
      return html
    },
    size: function() {
      return html.length
    }
  }
}

/**
 * get assets from current compilation
 * @param  {Compilation} compilation
 * @return {ojbect}
 */
RevReplacePlugin.prototype.getAssets = function(compilation) {
  var assets = {}
  var stats = compilation.getStats().toJson()
  var assetsByChunkName = stats.assetsByChunkName
  var publicPath = compilation.outputOptions.publicPath
  var opts = this.opts

  Object.keys(assetsByChunkName).forEach(function(key) {
    var chunks = assetsByChunkName[key]

    if (!Array.isArray(chunks)) chunks = [chunks]
    chunks.forEach(function(chunk) {
      var unrevedName = opts.modifyUnreved ? opts.modifyUnreved(key + path.extname(chunk)) : (key + path.extname(chunk))
      var revedName = opts.modifyReved ? opts.modifyReved(publicPath ? (publicPath + chunk) : chunk) : (publicPath ? (publicPath + chunk) : chunk)
      assets[unrevedName] = revedName
    })
  })

  return assets
}

/**
 * replace reved filename in the html content
 * @param  {string} html
 * @param  {object} assets
 * @return {string}
 */
RevReplacePlugin.prototype.replacePageAssets = function(html, assets) {
  var tagRegx = /<(link|script).*?(?:>(<\/script>)?|\/>)/gi
  var urlRegx = /(src|href)=[\'\"]?([^\'\">\s]*)[\'\"]?/i
  var htmlReplaced = html

  Object.keys(assets).forEach(function(key) {
    htmlReplaced = htmlReplaced.split(key).join(assets[key])
  })

  return htmlReplaced
}

module.exports = RevReplacePlugin
