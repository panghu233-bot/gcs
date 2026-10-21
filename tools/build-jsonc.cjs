// Reproducible browser bundle from lockfile-pinned upstream files; no CDN at runtime.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),source=path.join(root,'node_modules/jsonc-parser/lib/esm');
(async()=>{
 const build=await esbuild.build({stdin:{contents:fs.readFileSync(path.join(source,'main.js'),'utf8'),sourcefile:'main.js',loader:'js'},write:false,tsconfigRaw:{},bundle:true,format:'iife',globalName:'GCSJSONC',platform:'browser',target:'es2020',legalComments:'inline',plugins:[{name:'pinned-jsonc-source',setup(build){build.onResolve({filter:/.*/},args=>{if(!args.path.startsWith('.'))throw Error('Unexpected upstream external import');let name=path.posix.normalize(path.posix.join(path.posix.dirname(args.importer),args.path));if(!name.endsWith('.js'))name+='.js';if(name.startsWith('..'))throw Error('Import escaped vendor root');return {path:name,namespace:'jsonc-parser-3.3.1'};});build.onLoad({filter:/.*/,namespace:'jsonc-parser-3.3.1'},args=>({contents:fs.readFileSync(path.join(source,args.path),'utf8'),loader:'js'}));}}],banner:{js:'/* jsonc-parser 3.3.1 · Microsoft Corporation · MIT · See jsonc-parser.LICENSE.txt */'},footer:{js:'if (typeof module !== "undefined") module.exports = GCSJSONC;'}});
 fs.writeFileSync(path.join(root,'site/vendor/jsonc-parser.js'),build.outputFiles[0].contents);
 fs.copyFileSync(path.join(root,'node_modules/jsonc-parser/LICENSE.md'),path.join(root,'site/vendor/jsonc-parser.LICENSE.txt'));
})().catch(error=>{console.error(error);process.exitCode=1;});
