export function sourceLabel(source){
  return source.name+(Number.isInteger(source.page)&&source.page>0?' · 第 '+source.page+(Number.isInteger(source.endPage)&&source.endPage>source.page?'–'+source.endPage:'')+(/\.docx$/i.test(source.name)?' 段（重排）':' 页'):'');
}
