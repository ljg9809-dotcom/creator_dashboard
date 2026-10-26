export const STORAGE_KEY = 'busangi-chatbot-v1';
export function normalizeText(text) {return String(text).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s\p{P}\p{S}]/gu,'');}
export function validateFlow(flow) {
  if(!flow?.nodes?.[flow.root]||!flow.nodes[flow.fallbackTarget])throw Error('Invalid chatbot root');
  for(const [id,node] of Object.entries(flow.nodes)){if(typeof node.answer!=='string'||!Array.isArray(node.buttons))throw Error('Invalid node '+id);for(const button of node.buttons)if(!flow.nodes[button.next]||!button.label)throw Error('Invalid next node '+id);}
  return flow;
}
export function matchQuestion(flow,text){
  const query=normalizeText(text);if(!query)return null;
  for(const [action,phrases]of Object.entries(flow.commands||{}))if(phrases.some(p=>normalizeText(p)===query))return {action};
  let best=null,bestScore=0;
  for(const [id,node]of Object.entries(flow.nodes)){
    if(node.form)continue;
    const phrases=[node.question,...(node.keywords||[])];
    for(const phrase of phrases){const key=normalizeText(phrase);if(key&&(query===key||query.includes(key))){const score=key.length+(query===key?1000:0);if(score>bestScore){best={nodeId:id};bestScore=score;}}}
  }return best;
}
export function createState(flow){return {version:flow.version,open:false,nodeId:flow.root,trail:[],messages:[{role:'bot',nodeId:flow.root}],position:null};}
export function transition(flow,state,nodeId,label){if(!flow.nodes[nodeId])throw Error('Unknown chatbot node');return {...state,nodeId,trail:[...state.trail,state.nodeId].slice(-50),messages:[...state.messages,{role:'user',text:label},{role:'bot',nodeId}].slice(-80)};}
export function restoreState(flow,raw){
  try{const s=JSON.parse(raw);if(!s||s.version!==flow.version||!flow.nodes[s.nodeId]||!Array.isArray(s.trail)||!Array.isArray(s.messages))return createState(flow);
    const messages=s.messages.filter(m=>m&&(m.role==='user'&&typeof m.text==='string'||m.role==='bot'&&(flow.nodes[m.nodeId]||m.kind==='fallback'||m.kind==='reset'))).slice(-80).map(m=>m.role==='user'?{role:'user',text:m.text.slice(0,500)}:flow.nodes[m.nodeId]?{role:'bot',nodeId:m.nodeId}:{role:'bot',kind:m.kind});
    return {version:flow.version,open:s.open===true,nodeId:s.nodeId,trail:s.trail.filter(id=>flow.nodes[id]).slice(-50),messages:messages.length?messages:createState(flow).messages,position:s.position&&Number.isFinite(s.position.x)&&Number.isFinite(s.position.y)?{x:s.position.x,y:s.position.y}:null};
  }catch{return createState(flow);}
}
export function clampPosition(position,width,height,viewportWidth,viewportHeight){return {x:Math.max(8,Math.min(position.x,Math.max(8,viewportWidth-width-8))),y:Math.max(8,Math.min(position.y,Math.max(8,viewportHeight-height-8)))};}
