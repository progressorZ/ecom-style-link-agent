import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {findExactVisibleOption} from './pdd-select-option.mjs'
let browser
test.before(async()=>browser=await chromium.launch({headless:true}));test.after(async()=>browser.close())
test('scrolls rendered options to a later item and stops at end for missing item',async()=>{const p=await browser.newPage();try{
 await p.setContent('<ul role="listbox"><div id="scroll" style="height:100px;overflow:auto;position:relative"><div style="height:1000px" id="inner"></div></div></ul>')
 await p.evaluate(()=>{const sc=document.querySelector('#scroll'),inner=document.querySelector('#inner');const render=()=>{inner.innerHTML='';const first=Math.floor(sc.scrollTop/25);for(let i=first;i<Math.min(40,first+5);i++){const el=document.createElement('li');el.setAttribute('role','option');el.textContent='item-'+i;el.style=`position:absolute;top:${i*25}px;height:25px`;inner.append(el)}};sc.onscroll=render;render()})
 let guards=0;const option=await findExactVisibleOption(p,'item-35',async()=>{guards++});assert.equal(await option.textContent(),'item-35');assert.ok(guards>1)
 await assert.rejects(()=>findExactVisibleOption(p,'absent',async()=>{}),/UNAVAILABLE/)
 }finally{await p.close()}})
test('ambiguous option and guard failure never choose an alternative',async()=>{const p=await browser.newPage();try{await p.setContent('<ul role="listbox"><li role="option">A</li><li role="option">A</li></ul>');await assert.rejects(()=>findExactVisibleOption(p,'A',async()=>{}),/AMBIGUOUS/);await assert.rejects(()=>findExactVisibleOption(p,'B',async()=>{throw new Error('PAGE_CHANGED')}),/PAGE_CHANGED/)}finally{await p.close()}})
