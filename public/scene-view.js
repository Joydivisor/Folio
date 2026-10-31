import {vertices,operations,rotate,permutationFor} from './geometry.js';
import {cycles} from './groups.js';
import {inspectGeometry} from './experiment-math.js';

export function mountScene(host, {operation='vertex', explanation='',source='',generated=true,onSave}={}) {
  host.innerHTML='<div class="scene-artifact"><div class="scene-heading"><small>3D · 正四面体</small><h2>旋转，如何变成置换</h2></div><div class="scene-model"><div class="scene-viewport"><canvas tabindex="0" aria-label="三维正四面体；拖动或方向键转动视角，滚轮缩放"></canvas><span class="scene-hint">拖动观察 · 滚轮缩放</span><button class="scene-camera" title="重置视角">复位视角</button></div><div class="artifact-legend"><span style="--item-color:#c5964a"><i></i>顶点 1</span><span style="--item-color:#4f9d87"><i></i>顶点 2</span><span style="--item-color:#6a91cf"><i></i>顶点 3</span><span style="--item-color:#a481bc"><i></i>顶点 4</span></div></div><div class="scene-workbench"><div class="scene-controls"><button data-operation="vertex">顶点旋转 · 120°</button><button data-operation="edge">对边旋转 · 180°</button></div><div class="scene-result" aria-live="polite"></div><div class="scene-actions"><button data-action="apply">作用一次 →</button><button data-action="reset">回到恒等元</button></div><section class="artifact-section"><h3>连续观察旋转</h3><label>角度<input class="angle-preview" type="range" min="0" max="120" value="0" step="1" aria-label="旋转角度预览"><output class="angle-label">0°</output></label><label><input class="show-faces" type="checkbox" checked>显示半透明面</label><p class="verification" aria-live="polite"></p><table class="trace-table scene-mapping"><thead><tr><th>顶点</th><th>旋转后的位置</th></tr></thead><tbody></tbody></table></section></div><details class="scene-context"><summary>原文解读</summary><p class="scene-explanation"></p></details><p class="scene-note">实心点随旋转移动；空心点标记原位。拖动只改变观察视角，不改变群元素。正四面体的 12 个保向旋转构成 A₄。</p><div class="visual-source"></div><button class="wide-button scene-save">保存实验到笔记</button></div>';
  host.querySelector('.scene-context summary').textContent=explanation&&generated?'原文解读 · AI':'实验说明';
  host.querySelector('.scene-explanation').textContent=explanation||'沿一条对称轴旋转，观察四个顶点回到哪些位置。置换由旋转后的三维坐标计算。';
  host.querySelector('.visual-source').textContent=source||'本地几何实验';
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),box=host.querySelector('.scene-viewport');
  let points=vertices.map(v=>[...v]), yaw=.4,pitch=-.25,scale=1,frame=0,disposed=false,busy=false,steps=0,history=[];
  const colors=['#c5964a','#4f9d87','#6a91cf','#a481bc'];
  let preview=null,showFaces=true;
  const slider=host.querySelector('.angle-preview');
  const buttons=[...host.querySelectorAll('[data-operation]')];
  function update(){
    buttons.forEach(b=>{b.classList.toggle('active',b.dataset.operation===operation);b.disabled=busy;});
    host.querySelector('[data-action="apply"]').disabled=busy;host.querySelector('[data-action="reset"]').disabled=busy;
    host.querySelector('.scene-save').disabled=busy||preview!==null;slider.disabled=busy;
    slider.max=operation==='vertex'?'120':'180';
    const audit=inspectGeometry(vertices,preview||points), status=host.querySelector('.verification');
    status.dataset.state=preview!==null||busy?'preview':'complete';
    status.textContent=preview!==null?(audit.isSymmetry?'预览到达对称位置；点击「作用一次」提交旋转。':'中间角度仅作预览，顶点尚未回到原位，不对应 A₄ 中的群元素。'):'已核验：六条边长度保持不变；顶点一一对应原位。';
    host.querySelector('.scene-result').textContent=preview!==null?(audit.isSymmetry?'预览：'+cycles(audit.mapping):'旋转中 · '+slider.value+'°'):(audit.isSymmetry?cycles(audit.mapping):'顶点未对齐')+'  ·  '+steps+' 次作用';
    host.querySelector('.scene-mapping tbody').innerHTML=audit.mapping.map((target,i)=>'<tr style="--item-color:'+colors[i]+'"><td>● '+(i+1)+'</td><td>'+(target>=0?String(target+1):'尚未对齐')+'</td></tr>').join('');
    host.querySelector('.angle-label').textContent=slider.value+'°';
    if(busy){host.querySelector('.scene-result').textContent='正在旋转…';status.textContent='完成旋转后核验边长与顶点对应，表格暂保留上一次结果。';}
    else if(!audit.rigid||(!audit.isSymmetry&&preview===null)){status.textContent='几何检查未通过，请重置实验。';host.querySelector('.scene-save').disabled=true;}
  }
  function draw(){
    if(disposed)return;
    const w=box.clientWidth,h=box.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const project=v=>{const p=rotate(rotate(v,[0,1,0],yaw),[1,0,0],pitch),f=(Math.min(w,h)-40)*.27*scale/(1+p[2]*.12);return [w/2+p[0]*f,h/2-p[1]*f,p[2]];};
    const light=document.documentElement.dataset.theme==='light';
    const dots=(preview||points).map(project),fixed=vertices.map(project),axis=operations[operation].axis;
    const line=(a,b,color,dash=[])=>{ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);};
    // Ground grid and axis are world-space geometry, projected with the same camera.
    for(let i=-2;i<=2;i++){line(project([i,-1.4,-2]),project([i,-1.4,2]),light?'#334b6c0d':'#ffffff0d');line(project([-2,-1.4,i]),project([2,-1.4,i]),light?'#334b6c0d':'#ffffff0d');}
    line(project(axis.map(n=>n*1.65)),project(axis.map(n=>n*-1.65)),light?'#b0894e88':'#cfbe9388',[4,5]);
    const faces=[[0,1,2],[0,1,3],[0,2,3],[1,2,3]].sort((a,b)=>b.reduce((s,i)=>s+dots[i][2],0)-a.reduce((s,i)=>s+dots[i][2],0));
    for(const face of faces){ctx.beginPath();face.forEach((i,j)=>j?ctx.lineTo(dots[i][0],dots[i][1]):ctx.moveTo(dots[i][0],dots[i][1]));ctx.closePath();if(showFaces){ctx.fillStyle=light?'#6c98d01a':'#a5b4ca14';ctx.fill();}ctx.strokeStyle=light?'#6e8cad99':'#afbdd085';ctx.stroke();}
    fixed.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],16,0,Math.PI*2);ctx.strokeStyle=light?'#50678955':'#ffffff40';ctx.stroke();});
    dots.map((p,i)=>({p,i})).sort((a,b)=>b.p[2]-a.p[2]).forEach(({p,i})=>{const r=11/(1+p[2]*.08);ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fillStyle=colors[i];ctx.fill();ctx.strokeStyle='#ffffff50';ctx.stroke();ctx.font='11px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(String(i+1),p[0],p[1]);});
  }
  buttons.forEach(b=>b.onclick=()=>{operation=b.dataset.operation;preview=null;slider.value=0;update();draw();});
  host.querySelector('[data-action="apply"]').onclick=()=>{
    if(busy)return;preview=null;slider.value=0;busy=true;update();const start=performance.now(),initial=points.map(v=>[...v]),op=operations[operation],duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:850;
    function tick(now){if(disposed)return;const t=duration?Math.min(1,(now-start)/duration):1;points=initial.map(v=>rotate(v,op.axis,op.angle*(t*t*(3-2*t))));draw();if(t<1)frame=requestAnimationFrame(tick);else{steps++;history.push(op.label);busy=false;update();}}
    frame=requestAnimationFrame(tick);
  };
  host.querySelector('[data-action="reset"]').onclick=()=>{points=vertices.map(v=>[...v]);steps=0;history=[];preview=null;slider.value=0;update();draw();};
  host.querySelector('.scene-camera').onclick=()=>{yaw=.4;pitch=-.25;scale=1;draw();};
  host.querySelector('.scene-save').onclick=()=>onSave?.('正四面体旋转群 A₄\n'+explanation+'\n操作（按时间顺序）：'+(history.join(' → ')||'无')+'\n结果：'+cycles(permutationFor(points)));
  slider.oninput=()=>{preview=Number(slider.value)===0?null:points.map(v=>rotate(v,operations[operation].axis,Number(slider.value)*Math.PI/180));update();draw();};
  host.querySelector('.show-faces').onchange=e=>{showFaces=e.target.checked;draw();};
  const themeObserver=new MutationObserver(draw);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let drag=null;
  canvas.onpointerdown=e=>{if(e.button!==0)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch+=(e.clientY-drag[1])*.008;drag=[e.clientX,e.clientY];draw();};
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.6,Math.min(1.5,scale-e.deltaY*.001));draw();},{passive:false});
  canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();yaw+=e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0;pitch+=e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0;draw();};
  const observer=new ResizeObserver(draw);observer.observe(box);update();draw();
  return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();themeObserver.disconnect();};
}
