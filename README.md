# React-use-table-editor [![npm version](https://badge.fury.io/js/react-use-table-editor.svg)](https://badge.fury.io/js/react-use-table-editor) [![Build Status](https://github.com/Oblosys/react-use-table-editor/actions/workflows/build-test.yml/badge.svg?branch=master)](https://github.com/Oblosys/react-use-table-editor/actions/workflows/build-test.yml?query=branch%3Amaster)

The [`react-use-table-editor`](https://www.npmjs.com/package/react-use-table-editor) package exports a `useTableEditor` hook that maintains table-row state and provides cell-based update functions as well as dirty tracking for both cells and rows. The package also exports an `EditableTable` component that can be used with the hook result to easily build a table with custom cell-edit components that receive the cell state and dirty information via render-prop arguments.

The edit state is injected into each data row as a unique non-enumerable property, which allows other table packages to be used for building and rendering the table. The hook returns a number of strongly-typed edit functions for updating cell values, and adding, removing, or reverting rows.

A typical use case for this package is a page that offers batched editing for a list of server-based records. The table gets initialized with results from an api request, after which cells can be edited locally, and rows can be added or removed. Local changes are reflected in computed information like column sums, and can be reverted if necessary. A save button will send the modified rows to the api server and on success commit the changes to the local table.

To experiment with the package, you can open the [demo on CodeSandbox](https://codesandbox.io/s/react-use-table-editor-53m3j?file=/src/DemoTable.tsx).

<p align="center">
  <a href="https://codesandbox.io/s/react-use-table-editor-53m3j?file=/src/DemoTable.tsx">
    <img
      alt="Demo-table screenshot"
      src="https://raw.githubusercontent.com/Oblosys/react-use-table-editor/master/images/demo-table-screenshot.png"
      width="600"
    />
  </a>
</p>

## Features

- Dirty tracking of cell changes and added/removed rows
- Local changes can be reverted per row
- Strongly-typed cell update and equality functions
- Light-weight package with zero dependencies
- Designed to be used with other table packages for pagination, sorting, etc.

## Usage

The package can be installed with

```sh
> npm install react-use-table-editor
```

Note that the it is still under heavy development, so breaking changes are to be expected, and documentation will be sparse until the model stabilizes.

The demo table app in this repository ([also available on CodeSandbox](https://codesandbox.io/s/react-use-table-editor-53m3j?file=/src/DemoTable.tsx)) can be run locally with

```sh
> git clone git@github.com:Oblosys/react-use-table-editor
> cd react-use-table-editor
> npm install
> npm start
```
