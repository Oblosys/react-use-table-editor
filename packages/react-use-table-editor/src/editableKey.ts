// Unique symbol to identify editable rows. It needs to be in a separate module to prevent
// hot-reload problems with the npm-linked package, but it is not exported by the package.
export const editableKey = Symbol('editable')
