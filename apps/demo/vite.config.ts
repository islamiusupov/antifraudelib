import { createReadStream, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const workspaceRoot = resolve(__dirname, '../..');
const dBankDist = resolve(workspaceRoot, 'node_modules/d-bank/dist');

export default defineConfig({
  root: __dirname,
  plugins: [dBankStaticAssetsPlugin()],
  resolve: {
    alias: {
      '@deepcode/antifraud-core': resolve(workspaceRoot, 'packages/core/src/index.ts'),
      '@deepcode/antifraud-dbank-adapter': resolve(workspaceRoot, 'packages/dbank-adapter/src/index.ts'),
      '@deepcode/antifraud-react': resolve(workspaceRoot, 'packages/react/src/index.ts'),
      '@deepcode/antifraud-test-harness': resolve(workspaceRoot, 'packages/test-harness/src/index.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});

function dBankStaticAssetsPlugin(): Plugin {
  return {
    name: 'deepfraud-d-bank-static-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = decodeURIComponent((request.url ?? '/').split('?')[0]);
        if (!url.startsWith('/d-bank')) {
          next();
          return;
        }

        const dBankPath = url.replace(/^\/d-bank(?=\/|$)/, '') || '/';
        const relativePath = dBankPath === '/' ? 'index.html' : dBankPath.replace(/^\/+/, '');
        const filePath = resolve(dBankDist, relativePath);

        if (!filePath.startsWith(dBankDist) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          next();
          return;
        }

        response.setHeader('Content-Type', contentType(filePath));
        createReadStream(filePath).pipe(response);
      });
    },
    writeBundle() {
      copyDirectory(dBankDist, resolve(__dirname, 'dist/d-bank'));
    },
  };
}

function copyDirectory(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function contentType(filePath: string): string {
  const extension = extname(filePath);
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  return 'application/octet-stream';
}
