// @ts-check
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// eslint-config-next exports a flat config array directly
const nextConfig = require('eslint-config-next')
const nextTsConfig = require('eslint-config-next/typescript')

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  ...nextTsConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]

export default eslintConfig
