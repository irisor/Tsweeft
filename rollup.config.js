import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from "@rollup/plugin-terser";
import sass from 'rollup-plugin-sass';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';

// Shared plugins configuration
const sharedPlugins = [
  resolve(),
  commonjs(),
  terser()
];

// Create separate configurations for each entry point
export default [
  {
    input: 'src/sidepanel.js',
    output: {
      file: 'dist/sidepanel.js',
      format: 'esm',
      name: 'sidepanel'
    },
    plugins: [
      del({ 
        targets: 'dist/*',
        hook: 'buildStart',
        runOnce: true 
      }),
      ...sharedPlugins,
      sass({
        output: 'dist/styles.css',
        options: { sourceMap: true },
        outputStyle: 'compressed',
      }),
      copy({
        targets: [
          {
            src: ['src/content.css'],
            dest: 'dist'
          }
        ]
      })
    ]
  },
  {
    input: 'src/background.js',
    output: {
      file: 'dist/background.js',
      format: 'esm',
      name: 'background'
    },
    plugins: sharedPlugins
  },
  {
    input: 'src/content.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      name: 'content'
    },
    plugins: sharedPlugins
  },
  {
    input: 'src/utils/logger.js',
    output: {
      file: 'dist/logger.js',
      format: 'iife',
      name: 'logger'
    },
    plugins: sharedPlugins
  }
];