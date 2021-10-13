/* eslint-disable */
var path = require('path')

const { override, babelInclude } = require('customize-cra')

module.exports = function (config, env) {
  return Object.assign(
    config,
    override(
      babelInclude([
        path.resolve('src'),
        // The path below is not actually necessary to make linked or workspace packages work,
        // so this the override probably just disables the error message. For the demo this is fine though.
        path.resolve('packages/react-use-table-editor'),
      ]),
    )(config, env),
  )
}
