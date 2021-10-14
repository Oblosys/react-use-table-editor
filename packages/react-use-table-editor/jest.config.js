/* eslint-disable no-undef */
'use strict'

// @ts-check
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: './src/.+\\.test\\.ts$',
  collectCoverage: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}
