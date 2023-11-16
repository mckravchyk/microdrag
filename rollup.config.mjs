/* eslint-disable import/no-extraneous-dependencies, import/no-default-export */

// Using rollup-plugin-typescript2 rather than the official one as there are problems
// with generating type declarations
// https://github.com/rollup/plugins/issues/105
// https://github.com/rollup/plugins/issues/247
//
// import typescript from '@rollup/plugin-typescript'
import typescript from 'rollup-plugin-typescript2';

import terser from '@rollup/plugin-terser';
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

const defaults = {
  input: 'src/index.ts',
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
};

export default [
  // Common JS build + UMD builds for browsers
  {
    ...defaults,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        banner,
      },
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
      typescript(),
    ]
  },

  // ESM build + TypeScript declarations
  {
    ...defaults,
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
];
