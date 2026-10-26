import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateFlow,matchQuestion,createState,transition,restoreState,clampPosition} from '../chatbot-core.mjs';
const flow=validateFlow(JSON.parse(await readFile(new URL('../chatbot.json',import.meta.url),'utf8')));
const client=await import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('../inquiry-client.js',import.meta.url),'utf8')).toString('base64'));
test('all menu paths resolve and all nodes are reachable',()=>{
  const seen=new Set(),queue=[flow.root];
  while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);queue.push(...flow.nodes[id].buttons.map(b=>b.next));}
  assert.equal(seen.size,Object.keys(flow.nodes).length);
  assert.equal(flow.nodes.start.buttons.length,3);
});
test('Korean and English keywords select registered replies, unknown text has no invented reply',()=>{
  for(const [query,id]of [['부산기','about'],['인스타그램 링크','social'],['CSV 다운로드 방법','csv'],['제작 문의','production'],['개인정보 동의','privacy']])assert.equal(matchQuestion(flow,query).nodeId,id);
  assert.equal(matchQuestion(flow,'달나라 감자 축제'),null);
  assert.equal(matchQuestion(flow,'대화 초기화').action,'reset');
  assert.equal(flow.fallback,'등록된 안내를 찾지 못했어요, 기타 문의에서 1:1개인 상담 서비스를 이용해주세요');
});
test('session round trip preserves history and strips untrusted or stale state',()=>{
  let s=transition(flow,createState(flow),'other','기타 문의');
  s=transition(flow,s,'production','제작 문의');s.open=true;s.position={x:30,y:45};
  assert.deepEqual(restoreState(flow,JSON.stringify(s)),s);
  assert.equal(restoreState(flow,'broken').nodeId,flow.root);
  assert.equal(restoreState(flow,JSON.stringify({...s,version:999})).messages.length,1);
  assert.equal('email' in restoreState(flow,JSON.stringify({...s,email:'private@example.com'})),false);
  assert.deepEqual(clampPosition({x:-500,y:1000},390,630,1000,800),{x:8,y:162});
});
test('inquiries require consent and valid contact details; form sources share the configured table',async()=>{
  const c={enabled:true,supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_example',table:'existing_inquiries',fields:{email:'email',message:'content',consent:'consent',consentAt:'consented_at',source:'source'},categories:{production:'제작 문의'},privacy:{controller:'운영자',retention:'답변 완료 후 삭제'}};
  const v={email:'test@example.com',message:'제작 문의 테스트',consent:true,category:'production'};
  assert.throws(()=>client.validateInquiry({...v,consent:false}));
  assert.throws(()=>client.validateInquiry({...v,email:'invalid'}));
  assert.throws(()=>client.validateInquiry({...v,message:' '}));
  assert.equal(client.isConfigured({...c,enabled:false}),false);
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true}};
  try{
    await client.submitInquiry(c,v,'chatbot');await client.submitInquiry(c,v,'contact-page');
    assert.equal(calls[0].url,calls[1].url);assert.equal(calls[0].body.consent,true);
    assert.equal(calls[0].body.source,'chatbot');assert.equal(calls[1].body.source,'contact-page');
    await assert.rejects(client.submitInquiry({...c,publishableKey:'sb_secret_unsafe'},v,'chatbot'));
    globalThis.fetch=async()=>({ok:false});await assert.rejects(client.submitInquiry(c,v,'chatbot'));
  }finally{globalThis.fetch=original;}
});
