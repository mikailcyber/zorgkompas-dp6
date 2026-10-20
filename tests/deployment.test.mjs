import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const dist=new URL('../dist/',import.meta.url);
const publicBase=new URL('https://example.github.io/zorgkompas-dp6/');

function resourceReferences(path,source){
  if(path.endsWith('.html'))return [...source.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)].map(match=>match[1]);
  if(path.endsWith('.css'))return [...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(match=>match[1]);
  if(path.endsWith('.mjs'))return [...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g)].map(match=>match[1]);
  return [];
}

test('the complete page resource graph works under a GitHub Pages repository path',()=>{
  const pending=['index.html'],seen=new Set();
  while(pending.length){
    const path=pending.pop();if(seen.has(path))continue;seen.add(path);
    const local=new URL(path,dist),online=new URL(path,publicBase);
    assert.ok(existsSync(local),`Missing page resource: ${fileURLToPath(local)}`);
    if(!/\.(?:html|css|mjs)$/.test(path))continue;
    for(const reference of resourceReferences(path,readFileSync(local,'utf8'))){
      assert.match(reference,/^\.\.?\//,`Runtime resource must be relative: ${reference} in ${path}`);
      const target=new URL(reference,online);
      assert.ok(target.href.startsWith(publicBase.href),`Resource escapes the repository path: ${reference} in ${path}`);
      pending.push(target.pathname.slice(publicBase.pathname.length));
    }
  }
  for(const expected of ['app.mjs','ui.mjs','engine.mjs','simulation.mjs','privacy.mjs','styles.css','assets/favicon.svg','assets/inter-regular.ttf','assets/inter-medium.ttf','assets/inter-bold.ttf'])assert.ok(seen.has(expected),`Resource graph did not reach ${expected}`);
  assert.ok(existsSync(new URL('assets/Inter-OFL.txt',dist)),'Bundled font licence must remain available');
});

test('the static page permits only local scripts, fonts and styles without network connections',()=>{
  const page=readFileSync(new URL('index.html',dist),'utf8');
  assert.match(page,/script-src 'self'/);
  assert.match(page,/style-src 'self'/);
  assert.match(page,/font-src 'self'/);
  assert.match(page,/connect-src 'none'/);
});

test('GitHub Actions publishes only dist after the code check succeeds',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  const steps=workflow.split(/(?=^      - )/m);
  const uploads=steps.filter(step=>/uses:\s*actions\/upload-pages-artifact@/.test(step));
  assert.equal(uploads.length,1,'There must be one reviewed Pages artifact');
  assert.match(uploads[0],/^\s+path:\s*dist\/\s*$/m,'Publishing the project root would expose non-website files');
  assert.match(workflow,/\n  deploy:[\s\S]*?\n    needs: check\n/,'Deployment requires the checks to pass');
  assert.match(workflow,/run: npm run check/);
  assert.match(workflow,/if:.*github\.ref == 'refs\/heads\/main'.*github\.event_name != 'pull_request'/,'Pull requests must not publish a website');
  assert.match(workflow,/push:\s*\n\s+branches: \[main\]/,'New main commits should publish automatically');
});
