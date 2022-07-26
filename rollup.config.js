// Using rollup-plugin-typescript2 rather than the official one as there are problems
// with generating type declarations
// https://github.com/rollup/plugins/issues/105
// https://github.com/rollup/plugins/issues/247
//
// import typescript from '@rollup/plugin-typescript'
import typescript from 'rollup-plugin-typescript2';

import { terser } from 'rollup-plugin-terser';
import banner from 'rollup-plugin-banner';
import pkg from './package.json';

const copyright = `Copyright (c) 2020 ${pkg.author}`;
const bannerText = `${pkg.name} v${pkg.version}\n${copyright}\nLicense: ${pkg.license}`;

const defaults = {
  input: 'src/index.ts',
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
};

// Every build targets ES5

export default [
  // Common JS build + UMD builds for browsers
  {
    ...defaults,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
      },
      {
        file: `dist/${pkg.name}.js`,
        format: 'umd',
        name: 'FastDraggable',
      },
      {
        file: `dist/${pkg.name}.min.js`,
        format: 'umd',
        name: 'FastDraggable',
        plugins: [
          terser(),
        ],
      },
    ],
    plugins: [
      typescript(),
      banner(bannerText),
    ],
  },

  // ESM build + TypeScript declarations
  {
    ...defaults,
    output: {
      file: pkg.module,
      format: 'es',
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
      banner(bannerText),
    ],
  },
];
