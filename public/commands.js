// Shared by the visible menu and Electron's native menu. No placeholder actions.
export const menus=[
 {label:['文件','File'],items:[
 ['import','打开 / 导入文献…','Open / import documents…','Ctrl+O'],['folder','连接文件夹…','Connect folder…'],null,
 ['zotero','导入 Zotero…','Import Zotero…'],['backup','备份工作区…','Back up workspace…'],['restore','恢复备份…','Restore backup…'],['rollback','恢复上次导入前的数据…','Recover previous workspace…'],null,['artifacts','交互作品…','Interactive artifacts…'],['notes','笔记','Notes'],['export','导出全部笔记','Export all notes'],null,['settings','设置…','Settings…','Ctrl+,'],['close','关闭文档','Close document',null,'document']]},
 {label:['编辑','Edit'],items:[['undo','撤销','Undo','Ctrl+Z'],['redo','重做','Redo','Ctrl+Shift+Z'],null,['cut','剪切','Cut','Ctrl+X'],['copy','复制','Copy','Ctrl+C'],['paste','粘贴','Paste','Ctrl+V'],['selectAll','全选','Select all','Ctrl+A'],null,['search','搜索文献','Search library','Ctrl+K']]},
 {label:['视图','View'],items:[['library','文献库','Library'],['ai-panel','AI 辅助面板','AI panel',null,'reader'],['annotations','批注面板','Annotations',null,'reader'],['focus','专注画布','Focus canvas',null,'reader'],null,['zoom-in','放大','Zoom in',null,'reader'],['zoom-out','缩小','Zoom out',null,'reader'],['fit','适合宽度','Fit width',null,'reader'],null,['appearance','外观…','Appearance…'],['fullscreen','全屏','Full screen','F11']]},
 {label:['工具','Tools'],items:[['navigation','目录与全文搜索…','Outline & full-text search…',null,'reader'],['ocr','本页 OCR…','Recognize page text…',null,'reader'],['region','框选原文…','Select source region…',null,'reader'],null,['explore','解读 / 可视化选段','Explore / visualize selection',null,'selection'],['compile','批注整理为笔记','Create note from annotations',null,'reader'],['ai-settings','AI 与记忆…','AI & memory…']]},
 {label:['帮助','Help'],items:[['shortcuts','快捷键与使用指南','Shortcuts & guide'],['updates','检查更新…','Check for updates…'],['about','关于 Folio','About Folio']]}
];
export const commandIds=new Set(menus.flatMap(m=>m.items.filter(Boolean).map(i=>i[0])));
export function commandEnabled(item,{reader=false,selection=false,document=false}={}){return !item[4]||(item[4]==='document'?document:item[4]==='reader'?reader:reader&&selection);}
