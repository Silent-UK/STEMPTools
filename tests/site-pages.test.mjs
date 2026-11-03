import test from 'node:test';
import assert from 'node:assert/strict';
import {pageMarkdown} from '../public/page-markdown.mjs';
import {pageNavigation} from '../public/site-pages-model.mjs';
test('page Markdown supports documented formatting and preserves code as text',()=>{
 const html=pageMarkdown('## FAQ\n\n**Bold** and *italic* with `code`\n\n- One\n- Two\n\n1. Step\n\n> Note\n\n[Google](https://google.com)\n\n```\n<script>alert(1)</script>\n```');
 for(const tag of ['<h2>FAQ</h2>','<strong>Bold</strong>','<em>italic</em>','<ul>','<ol>','<blockquote>','<code>code</code>','rel="noopener noreferrer"'])assert.ok(html.includes(tag),tag);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('page Markdown rejects executable URLs and escapes raw HTML, quotes and image embeds',()=>{
 const html=pageMarkdown('<img src=x onerror=alert(1)>\n[x](javascript:alert(1))\n[x](data:text/html,bad)\n[x](//evil.test)\n[x](https://safe.test/"onclick="bad)\n[Mail](mailto:test@example.com)');
 assert.doesNotMatch(html,/<img|<script|href="javascript:|href="data:|href="\/\/| onclick=/);assert.match(html,/&lt;img/);assert.match(html,/href="mailto:test@example.com"/);
});
test('custom sidebar placement preserves built-in order, grouping and deterministic custom ordering',()=>{
 const pages=[{id:1,name:'FAQ',section:'personal',after:'wallet',position:20},{id:2,name:'Read Me',section:'personal',after:'start',position:1},{id:3,name:'Other',section:'pages',after:'end',position:1},{id:4,name:'Help',section:'personal',after:'wallet',position:10}];
 assert.deepEqual(pageNavigation('personal',[['overview','O','Overview'],['wallet','W','Wallet']],pages).map(r=>r[0]),['page-2','overview','wallet','page-4','page-1']);
 assert.deepEqual(pageNavigation('pages',[],pages).map(r=>r[0]),['page-3']);assert.equal(pages[0].id,1);
});
