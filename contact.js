import {mountInquiryForm} from './inquiry-client.js';
const category=document.querySelector('#category'),area=document.querySelector('#inquiry-form');
const param=new URLSearchParams(location.search).get('category');if([...category.options].some(o=>o.value===param))category.value=param;
let sequence=0;
async function show(){const current=++sequence,slot=document.createElement('div');try{await mountInquiryForm(slot,category.value,'contact-page');if(current===sequence)area.replaceChildren(slot);}catch{if(current===sequence)area.textContent='문의 양식을 불러오지 못한 상태입니다.';}}
category.addEventListener('change',show);show();
