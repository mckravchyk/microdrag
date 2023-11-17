/* eslint-disable import/no-extraneous-dependencies, import/no-default-export, no-console */

// Using rollup-plugin-typescript2 rather than the official one as there are problems
// with generating type declarations
// https://github.com/rollup/plugins/issues/105
// https://github.com/rollup/plugins/issues/247
//
// import typescript from '@rollup/plugin-typescript'
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import pkg from './package.json' assert { type: 'json' };

// rollup-plugin-banner does not work anymore and the default banner will do since there are no
// minified builds.
const createBanner = (lines) => `/**\n${lines.map((l) => ` * ${l}\n`).join('')} */`;

// FIXME: It is stripped away in the minified build
const banner = createBanner([
  `${pkg.name} v${pkg.version}`,
  `Copyright (c) 2020 ${pkg.author}`,
  `License: ${pkg.license}`,
]);

// Demo dev server
const demo = () => [
  {
    input: 'src/demo/index.ts',
    output: {
      file: 'demo/dist/demo.js',
      format: 'cjs',
      // exports: 'default',
    },
    plugins: [
      resolve({
        browser: true,
        // dedupe: ['enhanced-event-listener'],
      }),
      typescript(),
      commonjs(),
      serve({
        contentBase: ['demo'],
        host: 'localhost',
        port: 8080,
        onListening(server) {
          const address = server.address();
          const host = address.address === '::' ? 'localhost' : address.address;
          const protocol = this.https ? 'https' : 'http';
          console.log(`Server listening at ${protocol}://${host}:${address.port}/`);
        },
      }),
    ],
  },
];

const external = {
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
};

// Regular library bundle
const bundle = () => [
  // ESM build + TypeScript declarations
  {
    input: 'src/index.ts',
    external,
    output: {
      file: pkg.module,
      format: 'es',
      banner,
    },
    plugins: [
      typescript({
        tsconfig: 'tsconfig.json',
        tsconfigOverride: {
          compilerOptions: {
            declaration: true,
            declarationDir: './dist',
          },
        },
        useTsconfigDeclarationDir: true,
      }),
    ],
  },

  // CommonJS
  {
    input: 'src/index.ts',
    external,
    output: {
      file: pkg.main,
      format: 'cjs',
      banner,
    },
    plugins: [
      typescript(),
    ],
  },

  // UMD builds for browsers
  {
    input: 'src/index.ts',
    output: [
      {
        file: `dist/${pkg.name}.js`,
        format: 'umd',
        name: 'xydrag',
        banner,
      },
      {
        file: `dist/${pkg.name}.min.js`,
        format: 'umd',
        name: 'xydrag',
        banner,
        plugins: [
          terser(),
        ],
      },
    ],
    plugins: [
      resolve({ browser: true }),
      typescript(),
      commonjs(),
    ],
  },
];

export default process.env.dev === 'true' ? demo() : bundle();
