import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from "@rollup/plugin-terser";
import sass from 'rollup-plugin-sass';
import copy from 'rollup-plugin-copy';

export default {
  input: {
    sidepanel: 'src/sidepanel.js',    // Entry point for sidepanel logic
    background: 'src/background.js',  // Entry point for background service worker
    content: 'src/content.js'         // Entry point for content script
  },
  output: {
    dir: 'dist',                      // Output directory for bundled files
    format: 'esm',                    // Use ES module format
  },
  plugins: [
    resolve(),                        // Resolves modules from node_modules
    commonjs(),                       // Converts CommonJS modules to ES6
    terser(),                         // Minifies the code
    sass({
      output: 'dist/styles.css',     // Specifies the output CSS file
      options: { sourceMap: true },  // Disables source maps (optional)
      outputStyle: 'compressed',      // Minifies CSS output
    }),
    copy({
      targets: [
        {
          src: ['src/content.css'],
          dest: 'dist'
        }
      ]
    })
  ],
};
