// A small, deliberately limited Markdown dialect. Raw HTML is always text.
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function href(value){try{const url=new URL(value);return ['https:','http:','mailto:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return value.startsWith('/')&&!value.startsWith('//')&&!/[\\\s<>"']/.test(value)?value:null;}}
function inline(text,depth=0){if(depth>6)return escape(text);const pattern=/`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;let out='',last=0;for(const m of text.matchAll(pattern)){out+=escape(text.slice(last,m.index));if(m[1])out+='<code>'+escape(m[1])+'</code>';else if(m[2]){const url=href(m[3]);out+=url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${inline(m[2],depth+1)}</a>`:escape(m[0]);}else if(m[4])out+='<strong>'+inline(m[4],depth+1)+'</strong>';else out+='<em>'+inline(m[5],depth+1)+'</em>';last=m.index+m[0].length;}return out+escape(text.slice(last));}
export function pageMarkdown(value){
 const lines=String(value||'').slice(0,30000).replace(/\r\n?/g,'\n').split('\n'),out=[];let paragraph=[],list=null,code=null;
 const flush=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(s=>inline(s)).join('<br>')+'</p>');paragraph=[];}if(list){out.push('</'+list+'>');list=null;}};
 for(const line of lines){if(/^```/.test(line)){flush();if(code!==null){out.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');code=null;}else code=[];continue;}if(code!==null){code.push(line);continue;}
  if(!line.trim()){flush();continue;}const heading=/^(#{1,4})\s+(.+)$/.exec(line),item=/^\s*(?:([-*])|\d+\.)\s+(.+)$/.exec(line),quote=/^>\s?(.*)$/.exec(line);
  if(heading){flush();out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);}
  else if(item){if(paragraph.length)flush();const type=item[1]?'ul':'ol';if(list!==type){flush();list=type;out.push('<'+type+'>');}out.push('<li>'+inline(item[2])+'</li>');}
  else if(quote){flush();out.push('<blockquote>'+inline(quote[1])+'</blockquote>');}
  else if(/^---+$/.test(line.trim())){flush();out.push('<hr>');}
  else{if(list)flush();paragraph.push(line);}
 }
 flush();if(code!==null)out.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');return out.join('');
}
