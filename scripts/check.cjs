const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/render\(\);\s*$/,'');
let downloaded,clicked=false;
let ctx={console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout:()=>{},clearTimeout:()=>{},window:{},Blob,URL:{createObjectURL:b=>(downloaded=b,'blob:test'),revokeObjectURL:()=>{}},document:{createElement:()=>({click:()=>clicked=true})}};
vm.createContext(ctx);vm.runInContext(source,ctx);vm.runInContext(`
if(rows.length!==481||all().length!==480)throw Error('Duplicate removal failed');
if(sum(weekData('2026-10-19'),'views')!==8640)throw Error('Weekly goal total mismatch');
if(8640/10000*100!==86.4)throw Error('Achievement mismatch');
for(let p of [1,7,30,0]){period=p;let f=filtered();let channelTotal=CHANNELS.reduce((a,c)=>a+stats(f,c).views,0);if(channelTotal!==sum(f,'views'))throw Error('Channel rollup mismatch');if(contentRows().reduce((a,r)=>a+r.views,0)!==channelTotal)throw Error('Content rollup mismatch');if(sum(weekData('2026-10-19'),'views')!==8640)throw Error('Filter changed weekly total')}
period=1;if(CHANNELS.reduce((a,c)=>a+stats(filtered(),c).posts,0)!==0)throw Error('Counted old posts as newly uploaded');
period=7;let reco=recommend();if(reco.weeks.length!==4||reco.target!==8700)throw Error('Recommendation mismatch');
if(parseCSV('"title","views"\\r\\n"hello, \\"world\\"",3').length<1)throw Error('CSV parse error');
let parsed=parseCSV('a,b\\r\\n"hello, world","line 1\\nline 2"');if(parsed[1][0]!=='hello, world'||parsed[1][1]!=='line 1\\nline 2')throw Error('CSV quoting mismatch');
toast=()=>{};download('raw');
`,ctx);
assert(clicked);downloaded.text().then(t=>{assert(t.includes('"date","channel","post_id"'));assert.equal(t.split('\r\n').length,481);console.log('PASS: duplicate removal, weekly goal, four period rollups, upload counts, recommendation, CSV quoting/export.');});

