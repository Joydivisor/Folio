import {resolveAnchor} from './annotation-anchor.js';
export function setupAnnotations({getDocument,getPage,goPage,read,save,addNote,visualize,toast}){
  const $=id=>document.getElementById(id),store=read('folio-annotations',[]);
  const colors={yellow:'#e7c763',green:'#7cbe9a',blue:'#80a9df',pink:'#d493b2',purple:'#ad99cf'};
  let color='yellow',selection=null,root=null,observer=null,frame=0,activeId=null,deleted=null;
  const persist=()=>save('folio-annotations',store);
  const current=()=>store.filter(a=>a.documentId===getDocument().id).sort((a,b)=>a.page-b.page||a.created-b.created);
  function textRoot(){return $('documentContent').querySelector('.textLayer,.paper');}
  function capture(){
    const s=getSelection(),target=textRoot();
    if(!target||!s?.rangeCount||s.isCollapsed||!target.contains(s.anchorNode)||!target.contains(s.focusNode)){selection=null;return;}
    const range=s.getRangeAt(0),prefix=range.cloneRange();prefix.selectNodeContents(target);prefix.setEnd(range.startContainer,range.startOffset);
    const text=target.textContent,start=prefix.toString().length,exact=range.toString();
    if(!exact.trim()||exact.length>16000)return;
    selection={documentId:getDocument().id,page:getPage(),displayText:s.toString(),anchor:{start,end:start+exact.length,exact,prefix:text.slice(Math.max(0,start-32),start),suffix:text.slice(start+exact.length,start+exact.length+32)}};
  }
  document.addEventListener('selectionchange',capture);
  function makeRange(anchor){
    const target=textRoot();if(!target)return null;
    const match=resolveAnchor(target.textContent,anchor);if(!match)return null;
    const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT),range=document.createRange();let offset=0,startSet=false,node;
    while((node=walker.nextNode())){const next=offset+node.length;if(!startSet&&match.start<next){range.setStart(node,match.start-offset);startSet=true;}if(startSet&&match.end<=next){range.setEnd(node,match.end-offset);return range;}offset=next;}
    return null;
  }
  function paint(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      if(!root?.isConnected)return;root.querySelector('.annotation-layer')?.remove();
      const layer=document.createElement('div');layer.className='annotation-layer';layer.setAttribute('aria-hidden','true');
      const bounds=root.getBoundingClientRect();
      for(const a of current().filter(a=>a.page===getPage()&&a.anchor)){
        const range=makeRange(a.anchor);if(!range)continue;
        const seen=new Set();for(const rect of range.getClientRects()){
          const rectKey=[rect.left,rect.top,rect.width,rect.height].map(n=>Math.round(n*10)).join(',');if(seen.has(rectKey))continue;seen.add(rectKey);
          if(rect.width<1||rect.height<1)continue;
          const mark=document.createElement('span');mark.className='annotation-mark '+a.type+(a.id===activeId?' selected':'');mark.dataset.annotation=a.id;
          Object.assign(mark.style,{left:(rect.left-bounds.left)+'px',top:(rect.top-bounds.top)+'px',width:rect.width+'px',height:rect.height+'px'});mark.style.setProperty('--annotation-color',colors[a.color]||colors.yellow);layer.append(mark);
        }
      }
      root.append(layer);
    });
  }
  function showPanel(open=true){$('annotationPanel').hidden=!open;$('toggleAnnotations').setAttribute('aria-expanded',String(open));if(open)renderList();}
  async function reveal(a){
    activeId=a.id;
    if(a.page!==getPage())await goPage(a.page);
    paint();const range=a.anchor&&makeRange(a.anchor);
    if(a.anchor&&!range)toast('原文位置已变化，暂时无法精确定位；已打开对应页。');
    if(range){const rect=range.getBoundingClientRect(),vp=$('readerViewport');vp.scrollTop+=rect.top-vp.getBoundingClientRect().top-80;}
    renderList();
  }
  function noteText(a){return (a.text?'「'+a.text+'」\n\n':'')+(a.comment||'')+'\n\n'+a.documentName+' · 第 '+a.page+' 页';}
  function renderList(){
    const all=current(),query=$('annotationSearch').value.toLowerCase();
    $('annotationCount').textContent=all.length;
    const list=$('annotationList');list.replaceChildren();
    for(const a of all.filter(a=>(a.text+' '+a.comment+' '+a.page).toLowerCase().includes(query))){
      const card=document.createElement('article');card.className='annotation-card'+(a.id===activeId?' active':'');card.style.setProperty('--annotation-color',colors[a.color]);
      const head=document.createElement('div');head.className='annotation-card-head';
      const source=document.createElement('button');source.textContent='第 '+a.page+' 页 · '+({highlight:'高亮',underline:'下划线',note:'便笺'}[a.type]);source.onclick=()=>reveal(a);head.append(source);
      const palette=document.createElement('div');palette.className='annotation-palette';
      for(const [key,value]of Object.entries(colors)){const b=document.createElement('button');b.className='color-dot';b.style.setProperty('--annotation-color',value);b.setAttribute('aria-label','批注颜色：'+({yellow:'黄色',green:'绿色',blue:'蓝色',pink:'粉色',purple:'紫色'}[key]));b.setAttribute('aria-pressed',String(key===a.color));b.onclick=()=>{a.color=key;persist();renderList();paint();};palette.append(b);}
      const quote=document.createElement('button');quote.className='annotation-excerpt';quote.textContent=a.text||'此页便笺';quote.onclick=()=>reveal(a);
      const comment=document.createElement('textarea');comment.rows=3;comment.value=a.comment;comment.placeholder='添加评论…';comment.setAttribute('aria-label','第 '+a.page+' 页批注评论');comment.oninput=()=>{a.comment=comment.value;persist();};
      const actions=document.createElement('div');actions.className='annotation-actions';
      for(const [label,fn]of [['存为笔记',()=>addNote(noteText(a),{id:a.documentId,name:a.documentName,page:a.page,annotationId:a.id})],['询问 AI',()=>visualize({text:a.text+(a.comment?'\n问题：'+a.comment:''),id:a.documentId,name:a.documentName,page:a.page})],['删除',()=>{deleted=a;store.splice(store.indexOf(a),1);persist();$('undoAnnotation').hidden=false;renderList();paint();}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;actions.append(b);}
      card.append(head,palette,quote,comment,actions);list.append(card);
    }
    if(!list.children.length){const empty=document.createElement('p');empty.className='annotation-empty';empty.textContent=all.length?'没有匹配的批注。':'选中文字后点击「高亮」或「下划线」，也可以为当前页添加便笺。';list.append(empty);}
    $('compileAnnotations').disabled=!all.length;
  }
  function create(type){
    capture();const valid=selection?.documentId===getDocument().id&&selection.page===getPage();
    if(!valid&&type!=='note'){toast('先选中需要标记的原文。');return;}
    const anchor=valid?selection.anchor:null;
    const existing=store.find(a=>a.documentId===getDocument().id&&a.page===getPage()&&a.type===type&&a.anchor&&a.anchor.start===anchor?.start&&a.anchor.end===anchor?.end);
    if(existing){activeId=existing.id;showPanel();paint();return;}
    const a={id:crypto.randomUUID(),documentId:getDocument().id,documentName:getDocument().name,page:getPage(),type,color,anchor,text:valid?(selection.displayText||anchor.exact):'',comment:'',created:Date.now()};
    store.push(a);activeId=a.id;persist();selection=null;getSelection()?.removeAllRanges();showPanel();paint();
    [...$('annotationList').querySelectorAll('.annotation-card')].find(el=>el.classList.contains('active'))?.querySelector('textarea')?.focus();
  }
  for(const [id,type]of [['highlightSelection','highlight'],['underlineSelection','underline'],['addPageNote','note']]){$(id).onmousedown=e=>e.preventDefault();$(id).onclick=()=>create(type);}
  for(const [key,value]of Object.entries(colors)){const b=document.createElement('button');b.className='color-dot';b.style.setProperty('--annotation-color',value);b.setAttribute('aria-label','批注颜色：'+({yellow:'黄色',green:'绿色',blue:'蓝色',pink:'粉色',purple:'紫色'}[key]));b.setAttribute('aria-pressed',String(key===color));b.onmousedown=e=>e.preventDefault();b.onclick=()=>{color=key;[...$('annotationColors').children].forEach(el=>el.setAttribute('aria-pressed',String(el===b)));};$('annotationColors').append(b);}
  $('toggleAnnotations').onclick=()=>showPanel($('annotationPanel').hidden);$('closeAnnotations').onclick=()=>showPanel(false);
  $('annotationSearch').oninput=renderList;
  $('undoAnnotation').onclick=()=>{if(deleted){store.push(deleted);deleted=null;persist();renderList();paint();}$('undoAnnotation').hidden=true;};
  $('compileAnnotations').onclick=()=>{const all=current();if(all.length)addNote(getDocument().name+' · 批注汇总\n\n'+all.map(noteText).join('\n\n---\n\n'),{id:getDocument().id,name:getDocument().name,page:all[0].page});};
  $('exportAnnotations').onclick=()=>{const blob=new Blob(['# '+getDocument().name+'\n\n'+current().map(noteText).join('\n\n---\n\n')],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Folio-annotations.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('documentContent').addEventListener('click',e=>{
    if(getSelection()?.toString().trim())return;
    for(const mark of $('documentContent').querySelectorAll('.annotation-mark')){const r=mark.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){activeId=mark.dataset.annotation;showPanel();paint();break;}}
  });
  return {
    mount(){selection=null;observer?.disconnect();root=$('documentContent').querySelector('.pdf-page,.paper');if(root){observer=new ResizeObserver(paint);observer.observe(root);paint();}renderList();},
    async revealId(id){const a=store.find(a=>a.id===id&&a.documentId===getDocument().id);if(a){showPanel();await reveal(a);}},
  };
}
