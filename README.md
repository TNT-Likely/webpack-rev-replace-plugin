# webpack-rev-replace-plugin

Rewrite occurrences of filenames which have been renamed by webpack.

###demo code 
```js
var RevReplacePlugin = require('webpack-rev-replace-plugin');

module.exports = {
	entry: {},
	output: {
		path: './dist',
		publicPath: '/',
		filename: 'script/[name].[hash:6].js',
	},
	module: {
		loaders: [
			{
				test: /\.swig$/,
				loader: 'html'
			}
		]
	},
	plugins: [
		new RevReplacePlugin({
			cwd: './src',
			files: '**/*.swig',
			outputPageName: function (filename) {
				return filename;
			},
			modifyReved: function(filename) {
              return filename.replace(/(\/style\/|\/script\/)/, '')
            }
		})
	]
};
```
###before
```html
<!DOCTYPE html>
<html>
<head>
	<title></title>
	<script href='app.js'></script>
</head>
<body>

</body>
</html>
```
###after
```html
<!DOCTYPE html>
<html>
<head>
	<title></title>
	<script href='app.c54df8.js'></script>
</head>
<body>

</body>
</html>
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



