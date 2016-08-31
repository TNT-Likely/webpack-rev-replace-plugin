# webpack-rev-replace-plugin

Webpack is awesome, but it is not webpages friendly. it using javascript file as the entry to handle all the staffs.This plugin give you the ability to handle your webpages separately. It copy all the webpages your want to the output path, and all assets links are replaced with the webpack compiled version.

```javascript
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var RevReplacePlugin = require('webpack-rev-replace-plugin');
var glob = require('glob');
var path = require('path');

var cwd = process.cwd();
var entries = {};

glob.sync('**/entry_*.js', {root: './src/js'}).forEach(function (f) {
	var name = path.relative(cwd + '/src/js', f).replace(/\.js$/, '');
	entries[name] = path.resolve(f);
});

module.exports = {
	entry: entries,
	output: {
		path: 'dist',
		publicPath: '/app/',
		filename: 'assets/[name].[chunkhash:8].js',
		chunkFilename: 'assets/[name].[chunkhash:8].js'
	},
	module: {
		loaders: [
			{ test: /\.(jpe?g|png|gif|svg)$/i, loaders: [
				'image?{bypassOnDebug: true, progressive:true, optimizationLevel: 3, pngquant:{quality: "65-80", speed: 4}}',
				'url?limit=100&name=assets/img/[name].[hash:8].[ext]'
			]},
			{
				test: /\.less$/,
				loader: ExtractTextPlugin.extract('style', 'css!less')
			},
			{
				test: /\.html$/,
				loader: 'html'
			}
		]
	},
	plugins: [
		new ExtractTextPlugin('assets/[name].[contenthash:8].css', { allChunks: true }),
		
		new RevReplacePlugin({
			cwd: __dirname + '/src',
			files: '**/*.html',
			outputPageName: function (filename) {
				return filename;
			}, 
			entryName: function (name) {
				return name;
			}
		})
	]
};
```
## API

#### options.modifyUnreved, options.modifyReved
Type: `Function`

Modify the name of the unreved/reved files before using them. The filename is
passed to the function as the first argument.

For example, if in your manifest you have:

```js
{"js/app.js.map": "js/app-98adc164.js.map"}
```

If you wanted to get rid of the `js/` path just for `.map` files (because they
are sourcemaps and the references to them are relative, not absolute) you could
do the following:

```js
function modifyUnreved(filename) {
    if (filename.indexOf('.map') > -1) {
        return filename.replace('js/', '');
    }
    return filename;
}
```



