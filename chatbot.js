import {STORAGE_KEY,validateFlow,createState,restoreState,matchQuestion,transition,clampPosition} from './chatbot-core.mjs';
import {mountInquiryForm} from './inquiry-client.js';

const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
const chatIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg>';
let flow;
try{const response=await fetch(new URL('./chatbot.json',import.meta.url));if(!response.ok)throw Error('config');flow=validateFlow(await response.json());}
catch{const unavailable=create('a','busangi-chat-unavailable','챗봇 안내를 불러오지 못했습니다. 문의 페이지 →');unavailable.href='contact.html';document.body.append(unavailable);throw Error('등록된 챗봇 설정을 불러올 수 없습니다.');}
let saved=null;try{saved=sessionStorage.getItem(STORAGE_KEY)}catch{}
let state=restoreState(flow,saved),dragging=null;
const host=create('div','busangi-chat-host');
const launcher=create('button','busangi-chat-launcher');launcher.type='button';launcher.innerHTML=chatIcon;launcher.append(create('span',null,'부산기 안내'));launcher.setAttribute('aria-label',flow.ui.launcher);launcher.setAttribute('aria-controls','busangi-chat-panel');
const panel=create('section','busangi-chat-panel');panel.id='busangi-chat-panel';panel.setAttribute('aria-labelledby','busangi-chat-title');panel.hidden=true;
const header=create('header','busangi-chat-header');
const handle=create('div','busangi-chat-handle');handle.tabIndex=0;handle.setAttribute('aria-label',flow.ui.drag);handle.title=flow.ui.drag;
const avatar=create('img','busangi-chat-avatar');avatar.src=new URL('./assets/thumbnails/content-8.jpg',import.meta.url).href;avatar.alt='';
const heading=create('div');const title=create('h2',null,flow.title);title.id='busangi-chat-title';heading.append(title,create('p',null,flow.subtitle));handle.append(avatar,heading,create('span','busangi-drag-dots','⠿'));
const close=create('button','busangi-chat-close','×');close.type='button';close.setAttribute('aria-label',flow.ui.close);header.append(handle,close);
const tools=create('nav','busangi-chat-tools');tools.setAttribute('aria-label','대화 탐색');
for(const [action,label]of [['back',flow.ui.back],['home',flow.ui.home],['reset',flow.ui.reset]]){const b=create('button',null,label);b.type='button';b.dataset.action=action;b.onclick=()=>command(action);tools.append(b);}
const transcript=create('div','busangi-chat-transcript');transcript.setAttribute('role','log');transcript.setAttribute('aria-live','polite');transcript.setAttribute('aria-relevant','additions');transcript.tabIndex=0;
const choices=create('div','busangi-chat-choices');choices.setAttribute('aria-label','다음 선택지');
const formArea=create('div','busangi-chat-form-area');
const composer=create('form','busangi-chat-composer');const input=create('input');input.type='text';input.maxLength=500;input.autocomplete='off';input.placeholder=flow.ui.input;input.setAttribute('aria-label',flow.ui.input);const send=create('button',null,flow.ui.send);send.type='submit';composer.append(input,send);
const foot=create('p','busangi-chat-foot',flow.ui.privacyNote);
panel.append(header,tools,transcript,choices,formArea,composer,foot);host.append(panel,launcher);document.body.append(host);
function persist(){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{foot.textContent='이 브라우저는 임시 저장을 허용하지 않아 새로고침 후 대화 유지가 불가한 상태입니다.';}}
function setOpen(open,focus=true){state.open=open;panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open){positionPanel();if(focus)input.focus({preventScroll:true})}else if(focus)launcher.focus({preventScroll:true});persist();}
function positionPanel(){if(!state.position){panel.style.left='';panel.style.top='';panel.style.right='';panel.style.bottom='';return;}const r=panel.getBoundingClientRect();state.position=clampPosition(state.position,r.width,r.height,window.innerWidth,window.innerHeight);panel.style.left=state.position.x+'px';panel.style.top=state.position.y+'px';panel.style.right='auto';panel.style.bottom='auto';}
function bubble(message){const row=create('div','busangi-chat-row '+message.role);if(message.role==='user'){row.append(create('p','busangi-chat-bubble',message.text));return row;}
  const card=create('div','busangi-chat-bubble');if(message.nodeId){const n=flow.nodes[message.nodeId];card.append(create('p',null,n.answer));if(n.status==='pending')card.append(create('span','busangi-chat-pending','임시 안내'));
    if(n.links?.length){const links=create('div','busangi-chat-links');for(const l of n.links){try{const url=new URL(l.href,location.href);if(!['https:','http:'].includes(url.protocol))continue;const a=create('a',null,l.label+' ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}catch{}}card.append(links);}}
  else card.append(create('p',null,message.kind==='reset'?flow.ui.resetNotice:flow.fallback));row.append(card);return row;
}
function render(){transcript.replaceChildren(...state.messages.map(bubble));formArea.replaceChildren();choices.replaceChildren();tools.querySelector('[data-action="back"]').disabled=!state.trail.length;
  const last=state.messages.at(-1),node=flow.nodes[state.nodeId];
  panel.classList.toggle('has-form',!!node.form&&last?.kind!=='fallback');
  const next=last?.kind==='fallback'?[{label:flow.nodes[flow.fallbackTarget].question,next:flow.fallbackTarget}]:node.buttons;
  for(const option of next){const b=create('button',null,option.label);b.type='button';b.onclick=()=>go(option.next,option.label);choices.append(b);}
  if(node.form&&last?.kind!=='fallback'){mountInquiryForm(formArea,node.form,'chatbot').then(()=>{if(formArea.isConnected)formArea.scrollTop=0}).catch(()=>{formArea.append(create('p','busangi-form-pending','문의 양식을 불러오지 못한 상태입니다.'));});}
  panel.hidden=!state.open;launcher.setAttribute('aria-expanded',String(state.open));if(state.open)positionPanel();transcript.scrollTop=transcript.scrollHeight;
}
function go(id,label){state=transition(flow,state,id,label);render();persist();}
function command(action){
  if(action==='reset'){const wasOpen=state.open;state=createState(flow);state.open=wasOpen;try{sessionStorage.removeItem(STORAGE_KEY)}catch{};input.value='';render();return;}
  if(action==='back'){if(!state.trail.length)return;const previous=state.trail.pop();state.nodeId=previous;state.messages=[...state.messages,{role:'user',text:flow.ui.back},{role:'bot',nodeId:previous}].slice(-80);}
  if(action==='home'){state.trail=[];state.nodeId=flow.root;state.messages=[...state.messages,{role:'user',text:flow.ui.home},{role:'bot',nodeId:flow.root}].slice(-80);}
  render();persist();
}
composer.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim();if(!text){input.focus();return;}input.value='';const matched=matchQuestion(flow,text);if(matched?.action)return command(matched.action);if(matched?.nodeId)return go(matched.nodeId,text);state.messages=[...state.messages,{role:'user',text},{role:'bot',kind:'fallback'}].slice(-80);render();persist();});
launcher.onclick=()=>setOpen(!state.open);close.onclick=()=>setOpen(false);
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false)}});
handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=panel.getBoundingClientRect();dragging={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};handle.setPointerCapture(e.pointerId);panel.classList.add('is-dragging');e.preventDefault();});
handle.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.id)return;state.position={x:e.clientX-dragging.dx,y:e.clientY-dragging.dy};positionPanel();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,()=>{if(!dragging)return;dragging=null;panel.classList.remove('is-dragging');persist();});
handle.addEventListener('keydown',e=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();const r=panel.getBoundingClientRect(),step=e.shiftKey?40:10;state.position={x:r.left+moves[e.key][0]*step,y:r.top+moves[e.key][1]*step};positionPanel();persist();});
window.addEventListener('resize',()=>{if(state.open&&state.position){positionPanel();persist()}});
render();
