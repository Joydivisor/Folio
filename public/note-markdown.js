export function normalizeLatex(text=''){
 // Keep examples and code literal. Only standard math delimiters are normalized.
 return String(text).split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((s,i)=>i%2?s:s.replace(/\\\[([\s\S]*?)\\\]/g,(_,m)=>'\n$$\n'+m.trim()+'\n$$\n').replace(/\\\(([^]*?)\\\)/g,(_,m)=>'$'+m.trim()+'$')).join('');
}
export function createNoteMarkdown(MarkdownIt){
 const md=new MarkdownIt({html:false,linkify:false,typographer:false,breaks:false});
 md.inline.ruler.before('escape','folio_math',(state,silent)=>{
  const start=state.pos;if(state.src[start]!=='$'||state.src[start-1]==='\\')return false;
  const delimiter=state.src.startsWith('$$',start)?'$$':'$';let end=start+delimiter.length;
  if(delimiter==='$'&&/\s/.test(state.src[end]||''))return false;
  while((end=state.src.indexOf(delimiter,end))!==-1){if(state.src[end-1]!=='\\')break;end+=delimiter.length;}
  if(end<0||end===start+delimiter.length||delimiter==='$'&&(/\s/.test(state.src[end-1])||/\d/.test(state.src[end+1]||'')))return false;
  if(!silent){const token=state.push('folio_math','',0);token.content=state.src.slice(start,end+delimiter.length);}state.pos=end+delimiter.length;return true;
 });
 md.block.ruler.before('fence','folio_math_block',(state,startLine,endLine,silent)=>{
  const start=state.bMarks[startLine]+state.tShift[startLine],first=state.src.slice(start,state.eMarks[startLine]).trim();if(!first.startsWith('$$'))return false;
  let end=startLine,content=first;
  if(first.length<4||!first.endsWith('$$')){let found=false;for(end=startLine+1;end<endLine;end++){const line=state.src.slice(state.bMarks[end]+state.tShift[end],state.eMarks[end]);content+='\n'+line;if(line.trim().endsWith('$$')){found=true;break;}}if(!found)return false;}
  if(silent)return true;const token=state.push('folio_math_block','div',0);token.content=content;token.block=true;state.line=end+1;return true;
 });
 md.renderer.rules.folio_math=(tokens,i)=>'<span class="note-math">'+md.utils.escapeHtml(tokens[i].content)+'</span>';
 md.renderer.rules.folio_math_block=(tokens,i)=>'<div class="note-math-block">'+md.utils.escapeHtml(tokens[i].content)+'</div>\n';
 // Notes never fetch embedded remote images. Local region attachments are mounted separately.
 md.renderer.rules.image=(tokens,i)=>'<span class="note-image-reference">'+md.utils.escapeHtml(tokens[i].content||'Image')+'</span>';
 return md;
}
export function noteTitle(note){return note.title||note.question||String(note.text||'').split('\n').find(s=>s.trim())?.replace(/^#+\s*/,'').slice(0,120)||'Folio note';}
export function noteBody(note){
 let text=normalizeLatex(note.text||'');
 // Avoid duplicating the title of old plain-text notes, without rewriting stored text.
 const lines=text.split('\n');if(lines[0]?.replace(/^#\s+/,'').trim()===noteTitle(note).trim())text=lines.slice(1).join('\n').trimStart();
 return text;
}
export function safeNoteFilename(title){const value=String(title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,90);return !value||/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value)?'Folio-note':value;}
export function exportNoteMarkdown(note,{attachment,english=false}={}){
 const label=(zh,en)=>english?en:zh,s=note.source||{},title=noteTitle(note),quote=value=>String(value).split('\n').map(l=>'> '+l).join('\n'),yaml=value=>JSON.stringify(String(value));
 const metadata=['---','title: '+yaml(title),'folio_id: '+yaml(note.id||''),'source: '+yaml(s.name||''),'page: '+(Number.isInteger(s.page)?s.page:'null'),'date: '+yaml(note.createdAt||note.date||''),'tags: [folio]','---'];
 let out=metadata.join('\n')+'\n\n# '+title.replace(/\n/g,' ')+'\n\n';
 if(s.name)out+='> [!cite] '+label('来源','Source')+'\n'+quote(s.name+(s.page?' · '+label('第 '+s.page+' 页','Page '+s.page):''))+'\n\n';
 if(note.question)out+='## '+label('问题','Question')+'\n\n'+normalizeLatex(note.question)+'\n\n';
 out+=noteBody(note)+'\n';
 if(s.text)out+='\n## '+label('原文摘录','Source excerpt')+'\n\n'+quote(normalizeLatex(s.text))+'\n';
 if(attachment)out+='\n!['+label('原文选区','Source region')+']('+attachment+')\n';
 if(note.turns?.length)out+='\n## '+label('完整对话','Conversation')+'\n\n'+note.turns.map((turn,i)=>'### '+(i+1)+'. '+turn.question.replace(/\n/g,' ')+'\n\n'+turn.answer.paragraphs.map(p=>normalizeLatex(p.text)+(p.sources?.length?'\n\n'+p.sources.map(c=>'> '+label('第 '+c.page+' 页','Page '+c.page)+': '+normalizeLatex(c.quote).replace(/\n/g,'\n> ')).join('\n'):'')).join('\n\n')).join('\n\n')+'\n';
 return out;
}
