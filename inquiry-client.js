let configPromise;
export function loadInquiryConfig(){return configPromise??=fetch(new URL('./inquiry-config.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('문의 설정을 읽지 못했습니다.');return r.json()});}
export function isConfigured(c){return c.enabled===true&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl)&&!!c.publishableKey&&/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.table)&&['email','message','consent','consentAt'].every(k=>/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.fields?.[k]||''))&&!!c.privacy?.controller&&!!c.privacy?.retention;}
export function validateInquiry(values){
  if(!values.consent)throw Error('개인정보 수집·이용 동의가 필요한 항목입니다.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email||'')||values.email.length>254)throw Error('올바른 답변 이메일이 필요한 항목입니다.');
  if(!values.message?.trim()||values.message.length>3000)throw Error('문의 내용은 1~3,000자로 입력하는 항목입니다.');
  if((values.name||'').length>80)throw Error('이름은 80자 이하로 입력하는 항목입니다.');
}
export function createPayload(c,v,source){
  validateInquiry(v);const p={...(c.fixedValues||{})};
  const data={name:v.name?.trim()||null,email:v.email.trim(),message:v.message.trim(),category:c.categories[v.category]||v.category,consent:true,consentAt:new Date().toISOString(),source};
  for(const [key,column]of Object.entries(c.fields||{}))if(column&&Object.hasOwn(data,key))p[column]=data[key];
  return p;
}
export async function submitInquiry(c,values,source){
  validateInquiry(values);if(!isConfigured(c))throw Error('기존 문의 페이지의 Supabase 저장 설정 확인 전으로 접수가 불가한 상태입니다.');
  if(c.publishableKey.startsWith('sb_secret_'))throw Error('문의 저장 설정에 사용할 수 없는 키입니다.');
  if(c.publishableKey.startsWith('eyJ')){try{const role=JSON.parse(atob(c.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role!=='anon')throw Error('role')}catch{throw Error('공개용 문의 저장 키가 아닌 설정입니다.');}}
  const payload=createPayload(c,values,source);const response=await fetch(c.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+encodeURIComponent(c.table),{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('문의 저장에 실패한 상태입니다. 잠시 후 다시 시도해 주시기 바랍니다.');
}
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
export async function mountInquiryForm(container,category='consultation',source='chatbot'){
  const c=await loadInquiryConfig(),ready=isConfigured(c),form=el('form',null,'busangi-inquiry-form');
  const status=el('p',null,'busangi-form-status');status.setAttribute('role','status');
  const title=el('h3',c.categories[category]||'문의 접수');form.append(title);
  if(source==='chatbot'){const full=el('a','전체 문의 페이지에서 작성하기 ↗','busangi-inquiry-page-link');full.href='contact.html?category='+encodeURIComponent(category);form.append(full);}
  if(!ready){const banner=el('p','문의 저장 연동 준비 중입니다. 기존 문의 페이지의 저장 테이블과 개인정보 안내가 확인되면 접수가 가능한 상태입니다.','busangi-form-pending');form.append(banner);}
  const name=el('input'),email=el('input'),message=el('textarea');
  name.name='name';name.maxLength=80;name.autocomplete='name';email.name='email';email.type='email';email.required=true;email.maxLength=254;email.autocomplete='email';message.name='message';message.required=true;message.maxLength=3000;message.rows=4;
  for(const [labelText,input]of [['이름 (선택)',name],['답변 이메일 (필수)',email],['문의 내용 (필수)',message]]){const label=el('label',labelText);label.append(input);form.append(label);}
  const notice=el('details');notice.append(el('summary','개인정보 수집·이용 안내'));
  const purpose=c.privacy?.purpose||'문의 접수 및 답변';notice.append(el('p',`수집 항목: 이름(선택), 이메일, 문의 내용입니다.\n이용 목적: ${purpose}입니다.\n수집·관리 주체: ${c.privacy?.controller||'확인 전'}입니다.\n보유 기간: ${c.privacy?.retention||'확인 전'}입니다.\n동의를 거부할 수 있으며, 동의하지 않으면 문의 접수가 불가한 방식입니다.`));form.append(notice);
  const consent=el('input');consent.type='checkbox';consent.name='privacy_consent';consent.required=true;const check=el('label',null,'busangi-consent');check.append(consent,document.createTextNode('개인정보 수집·이용에 동의합니다. (필수)'));form.append(check);
  const send=el('button',ready?'문의 접수하기':'문의 저장 연동 준비 중','busangi-submit');send.type='submit';send.disabled=!ready;form.append(send,status);
  const stamp=el('p','입력한 개인정보는 대화 기록과 sessionStorage에 저장되지 않습니다.','busangi-form-note');form.append(stamp);
  let busy=false;
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;send.disabled=true;status.textContent='문의 저장 중입니다.';
    try{await submitInquiry(c,{name:name.value,email:email.value,message:message.value,consent:consent.checked,category},source);form.reset();status.textContent='문의가 정상 접수된 상태입니다. 담당자가 확인 후 이메일로 답변하는 방식입니다.';}
    catch(error){status.textContent=error.name==='TimeoutError'?'응답이 지연된 상태입니다. 중복 접수를 피하도록 잠시 후 확인해 주시기 바랍니다.':error.message;}finally{busy=false;send.disabled=!ready;}});
  container.replaceChildren(form);return form;
}
