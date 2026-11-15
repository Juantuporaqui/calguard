/** Local synthetic fixture only. Serve dist on a separate test origin, never production. */
import { readFile, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
async function copyApp(source, target) {
  await mkdir(target, { recursive: true });
  const sw = await readFile(path.join(source, 'service-worker.js'), 'utf8');
  const assets = [...sw.split('const ASSETS_TO_CACHE = [')[1].split('];')[0].matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  for (const name of [...assets, 'service-worker.js']) {
    const destination = path.join(target, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, name), destination);
  }
  const html = (await readFile(path.join(source, 'index.html'), 'utf8'))
    .replace('<script src="js/ui/visualThemeBoot.js">', '<script src="/qa-config.js"></script><script src="js/ui/visualThemeBoot.js">')
    .replace('src="js/app.js"', 'src="/qa-boot.js"');
  await writeFile(path.join(target, 'qa-frame.html'), html);
}
await copyApp(root, path.join(root, 'dist'));
if (process.argv[2]) await copyApp(path.resolve(process.argv[2]), path.join(root, 'dist/baseline'));
await cp(path.join(root, 'tests/browser/instrumental'), path.join(root, 'dist'), { recursive: true });
console.log('Prepared dist/qa.html. Use an isolated local origin. Baseline comparison requires the original checkout as argument.');
