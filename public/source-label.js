export function sourceLabel(source){
  return source.name+(Number.isInteger(source.page)&&source.page>0?' · 第 '+source.page+' 页':'');
}
