// Rebuild the embedded, self-contained worker using this checkout's exact kernel.
const fs=require('fs'),path=require('path'),vm=require('vm')
const root=path.resolve(__dirname,'..'),file=path.join(root,'client.js')
let source=fs.readFileSync(file,'utf8')
function grab(name) {
  const start=source.indexOf('const '+name+' = ')
  if(start<0)throw Error('Missing kernel function '+name)
  let depth=0
  for(let i=source.indexOf('{',start);i<source.length;i++){
    if(source[i]==='{')depth++
    if(source[i]==='}' && --depth===0)return source.slice(start,i+1)
  }
  throw Error('Unbalanced kernel '+name)
}
const names=['contourRng','contourBuild','contourBuildCandidate','contourCoverageScore',
  'contourEvaluate','contourExtractLevel','contourExtract','contourDrawLines']
let worker=fs.readFileSync(path.join(root,'src/contour-worker.js'),'utf8')
worker=worker.replace('/* CONTOUR_KERNEL */',names.map(grab).join('\n'))
worker=worker.replace('/* CONTOUR_WEBGL */',fs.readFileSync(path.join(root,'src/contour-webgl.js'),'utf8'))
new vm.Script(worker)
const start='    /* BEGIN GENERATED CONTOUR WORKER */',end='    /* END GENERATED CONTOUR WORKER */'
const a=source.indexOf(start),b=source.indexOf(end,a)
if(a<0 || b<0)throw Error('Missing generated worker markers')
const next=source.slice(0,a)+start+'\n    const CONTOUR_WORKER_SOURCE = '+JSON.stringify(worker)+'\n'+end+source.slice(b+end.length)
if(process.argv.includes('--check')) {
  if(next!==source)throw Error('Embedded worker is stale; run npm run build:worker')
} else fs.writeFileSync(file,next)
console.log('Contour worker verified: '+worker.length+' characters')
