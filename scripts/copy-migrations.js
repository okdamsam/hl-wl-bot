// Copies SQL migration files into dist/ after tsc compilation.
// Required because Node.js ESM resolves migrations relative to the compiled file.
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const src = join('src', 'db', 'migrations');
const dest = join('dist', 'db', 'migrations');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('Migrations copied to dist/db/migrations/');
}
