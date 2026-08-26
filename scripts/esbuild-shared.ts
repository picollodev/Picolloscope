import * as fs from 'fs'
import * as path from 'path'
import * as esbuild from 'esbuild'
import packageJson from '../package.json'

const entryPoint = 'src/speedscope.tsx'

export const buildOptions: esbuild.BuildOptions = {
  entryPoints: [
    entryPoint,

    // Ensure that all of these files end up being discovered by esbuild and copied into the output directory
    'assets/favicon.png',
  ],
  entryNames: '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
  sourcemap: true,
  bundle: true,
  define: {
    __SPEEDSCOPE_VERSION__: JSON.stringify(packageJson.version),
  },
  format: 'esm',
  splitting: true,
  loader: {
    '.txt': 'file',
    '.woff2': 'file',
    '.png': 'file',
    '.ico': 'file',
    '.json': 'file',
    '.wasm': 'file',
  },
}

interface GenerateIndexHtmlOptions {
  buildResult: esbuild.BuildResult
  outdir: string
  servingProtocol: 'file' | 'http'
}

function copyStaticOutputFiles(outdir: string) {
  fs.copyFileSync('assets/embedding.html', path.join(outdir, 'embedding.html'))
  fs.copyFileSync('sample/profiles/speedscope/sample.json', path.join(outdir, 'sample.json'))
  fs.copyFileSync('sample/profiles/speedscope/0.6.0/two-sampled.speedscope.json', path.join(outdir, 'sample2.json'))
  fs.copyFileSync('LICENSE', path.join(outdir, 'LICENSE'))
  fs.copyFileSync('LICENSE.ThirdParties', path.join(outdir, 'LICENSE.ThirdParties'))
  fs.copyFileSync('assets/source-code-pro/LICENSE.md', path.join(outdir, 'source-code-pro.LICENSE.md'))
}

export const generateIndexHtml = ({
  buildResult,
  outdir,
  servingProtocol,
}: GenerateIndexHtmlOptions) => {
  const outputs = buildResult.metafile!.outputs

  function getOutput(entryPoint: string): [string, esbuild.Metafile['outputs'][string]] {
    const key = Object.keys(outputs).find(key => outputs[key].entryPoint === entryPoint)!
    return [key, outputs[key]]
  }

  function getHashedFilePath(name: string) {
    return path.basename(getOutput(name)[1].imports.find(i => i.kind === 'file-loader')!.path)
  }

  const [mainChunkPath, mainChunk] = getOutput(entryPoint)
  const mainChunkName = path.basename(mainChunkPath)

  const mainChunkCssPath = mainChunk.cssBundle!
  const cssChunk = outputs[mainChunkCssPath]

  const fontPath = cssChunk.imports.find(i => i.path.endsWith('.woff2'))!.path
  const fontName = path.basename(fontPath)

  const syncDependencyNames = mainChunk.imports
    .filter(i => i.kind === 'import-statement')
    .map(i => path.basename(i.path))
  const asyncDependencyNames = mainChunk.imports
    .filter(i => i.kind === 'dynamic-import')
    .map(i => path.basename(i.path))

  // If we're serving from a file protocol, we can't use module
  // scripts
  const scriptType = servingProtocol === 'file' ? '' : ' type="module"'

  const faviconPath = getHashedFilePath('assets/favicon.png')

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>speedscope</title>
    <link rel="stylesheet" href="${path.basename(mainChunk.cssBundle!)}">
    <link rel="icon" type="image/png" sizes="512x512" href="${faviconPath}">
  </head>
  <body>
    <script src="${mainChunkName}"${scriptType}></script>
    ${syncDependencyNames.map(dep => `<script src="${dep}"${scriptType}></script>`).join('\n    ')}
    ${asyncDependencyNames
      .map(
        dep =>
          `<script src="${dep}"${scriptType}${
            servingProtocol === 'file' ? '' : ' async'
          }></script>`,
      )
      .join('\n    ')}
    ${
      /* Preload is blocked by CORS, so we can't use it with file:/// URLs */
      servingProtocol === 'file'
        ? ''
        : `<link rel="preload" href="${fontName}" as="font" type="font/woff2" crossorigin>`
    }
  </body>
</html>
`

  fs.writeFileSync(`${outdir}/index.html`, html)
  copyStaticOutputFiles(outdir)
}
