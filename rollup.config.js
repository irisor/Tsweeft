import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";
import scss from 'rollup-plugin-scss';

export default {
  input: {
    popup: 'src/popup.js',           // Entry point for popup logic
    // background: 'src/background.js',  // Entry point for background service worker
    content: 'src/content.js'         // Entry point for content script
  },
  output: {
    dir: 'dist',                      // Output directory for bundled files
    format: 'esm',                    // Use ES module format
    assetFileNames: '[name][extname]' // Removes the hash from the asset filename
  },
  plugins: [
    resolve(),                        // Resolves modules from node_modules
    commonjs(),                       // Converts CommonJS modules to ES6
    terser(),                         // Minifies the code
    scss({
      fileName: 'styles.css',
    })
  ]
};
