// Hints select a representation; they never manufacture experimental parameters.
export function requestsTextOnly(question='',mode){
 const q=String(question);
 if(/(?:只|仅)(?:需要|需|用|要)?(?:纯)?(?:文字|文本|口头)|(?:纯文字|纯文本)(?:解释|说明|回答)|\b(?:text|prose)[ -]only\b|\bonly (?:use )?(?:text|prose)\b/i.test(q))return true;
 const prohibitions=q.matchAll(/(?:不要|不用|无需|不需要|别)(?:再)?(?:给我|使用|生成|绘制|添加|展示|画|配|做|任何|[这那]个){0,3}(图表|图|表|可视化|演示|画布|3D)|\b(?:no|without) (?:any )?(diagrams?|visuals?|tables?|graphics?|3D)\b/gi);
 for(const match of prohibitions){
  const target=match[1]||match[2];
  if(!mode||target==='图表')return true;
  if(/^(表|table)/i.test(target)){if(mode==='compare')return true;}
  else if(/^3D$/i.test(target)){if(mode==='3d')return true;}
  else if(!['compare','derive','explain'].includes(mode))return true;
 }
 return false;
}
export function prefersText(question=''){
 return requestsTextOnly(question)||/(?:不要|不用|无需|不需要|别)(?:再)?[^。\n]{0,8}(?:图|表|可视化|演示|画布)|(?:只|仅)(?:用|需|要)?[^。\n]{0,8}(?:文字|一句|解释)|(?:用|限|只需)?[一二两三四五六七八九十\d]+(?:句|句话)|\b(?:one|two|three|\d+) sentences?\b/i.test(String(question));
}
export function requestsArtifactEdit(question=''){
 return /(?:修改|改成|改为|改一下|改掉|更改|替换|删除|删掉|添加|新增|增加|移除|重写|重画|调整|保留.*其余)|\b(?:edit|change|replace|remove|delete|add|update|rewrite)\b/i.test(String(question));
}
export function preferredReadingKind(question=''){
 const q=String(question);
 if(prefersText(q))return 'explain';
 if(/(?:什么意思|是什么|含义)|\b(?:what is|meaning of|explain the word)\b/i.test(q)&&!/(?:画|绘制|生成).{0,8}(?:图|表)|\b(?:draw|diagram|visualize)\b/i.test(q))return null;
 if(/流程图|flowchart|flow chart|(?:画|绘制).{0,8}流程/i.test(q))return 'diagram';
 if(/comparison|对比表|比较|对比|区别|\bcompare\b|difference between/i.test(q))return 'comparison';
 if(/derivation|分步推导|逐步证明|请证明|^证明|拉格朗日定理|\b(?:prove|derive)\b|step.by.step proof/i.test(q))return 'derivation';
 if(/分步过程|步骤演示|step.by.step process/i.test(q))return 'process';
 if(/(?:σ|τ|\\sigma|\\tau)\s*=\s*\(\s*[1-8](?:[\s,，]+[1-8])+\s*\)/u.test(q))return 'permutation';
 if(/(?:S[₃₄₅345]|S_\{?[345]).*(?:可解|导出|交换子)/i.test(q))return 'derived';
 return null;
}
