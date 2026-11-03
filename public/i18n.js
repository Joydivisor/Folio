// Interface strings only. Documents, answers, quotes and authored notes are never translated.
export const dictionary = Object.fromEntries(`
资料|Details
标签筛选|Filter by tag
文献筛选|Filter documents
全部状态|All statuses
未读|Unread
阅读中|Reading
已读|Read
未分类|Unfiled
有笔记|With notes
我的分类|My collections
新建分类|New collection
分类|Collections
分类笔记|Collection notes
按文献查看笔记|Notes by document
全部笔记|All notes
导出当前笔记|Export shown notes
在笔记库打开|Open in Notes
框选|Select area
框选原文|Select source region
导出 Markdown|Export Markdown
预览|Preview
阅读与记忆偏好|Reading & memory preferences
模型服务|Model provider
使用模型|Model
连接并获取模型|Connect & load models
在本机加密保存，重启后继续使用|Save encrypted on this device for future sessions
清除此服务密钥|Remove this provider’s key
模型 ID|Model ID
测试模型调用|Test model access
保存并使用|Save & use
粘贴此服务的 API Key|Paste this provider’s API key
已识别密钥，点击测试连接后验证。|Key detected. Test the connection to verify it.
粘贴密钥，或包含密钥的一段文本|Paste a key or text containing one
恢复交互实验|Restore interactive experiment
请先重新连接原文，再恢复交互实验。|Reconnect the source document to restore this experiment.
播放一个周期|Play one cycle
暂停|Pause
重复作用 σ|Repeat σ
拖入一段原文|Drop a passage here
选中左侧文字，拖到这里。|Select text in the reader and drag it here.
把定义、关系与步骤展开来看。|Explore definitions, relationships and steps.
原文|Source
概念|Concept
关系|Relation
置换群|Permutations
可解群|Solvable groups
3D 旋转|3D rotations
正在理解这段内容|Understanding this passage
识别对象、参数与运算约定|Identifying objects, parameters and conventions
正在理解选段与运算约定|Reading the selection and conventions
正在查阅原文|Reading document context
正在结合原文解释选段|Explaining with document context
正在整理回答格式|Formatting the answer
解读已完成，正在整理关系图|Explanation ready. Preparing the diagram
正在整理关系图格式|Formatting the diagram
调整两栏宽度|Resize reading panels
更多阅读操作|More reading actions
连接成功|Connected
文本按段长度分页 · 支持选段引用|Text paginated by length · Select passages to explore
此页没有可提取的文字（扫描件）；本版尚未接入 OCR。|No extractable text on this page. OCR is not available yet.
设置已保存；密钥仍由本机服务托管。|Settings saved. The key remains managed by the local service.
密钥仅在当前页面有效。|The key is available for this page session only.
密钥已在本机加密保存。|The key is stored encrypted on this device.
密钥仅在本次应用运行有效。|The key is available for this app session only.
笔记来源路径|Note source path
颜色|Color
批注颜色|Annotation color
批注颜色：黄色|Yellow
批注颜色：绿色|Green
批注颜色：蓝色|Blue
批注颜色：粉色|Pink
批注颜色：紫色|Purple
点击刷新以重新授权|Refresh to reconnect this folder
已连接 · 文件保存在本机|Connected · Files stay on this device
导入文献将复制到所选文件夹|Imported documents are copied to the connected folder
文件|File
编辑|Edit
视图|View
工具|Tools
帮助|Help
设置|Settings
通用|General
外观|Appearance
阅读|Reading
AI 与记忆|AI & memory
文献库与存储|Library & storage
界面语言|Interface language
只改变界面，保留原文与已有笔记。|Changes the interface only. Documents and existing notes stay unchanged.
跟随系统|System
常规偏好即时生效并保存在本机。|Preferences apply immediately and are saved on this device.
颜色模式|Color scheme
日间|Light
夜间|Dark
减少动态效果|Reduce motion
关闭等待光效和非必要动画。|Disable the waiting glow and nonessential animations.
显示阅读提示|Show reading hints
自动参考本书原文|Include document context
提问时提供当前文献的相关段落。|Include relevant passages from this document when asking a question.
阅读位置会自动保存，下次打开继续阅读。|Your reading position is saved automatically.
文件与笔记保存在本机。|Files and notes are stored on this device.
导出全部笔记|Export all notes
网页版与桌面版使用独立存储。导出 Markdown 可备份笔记；请同时备份原始文献。|Web and desktop storage are separate. Export notes as Markdown for backup, and back up the original documents too.
回答语言|Response language
跟随提问|Match the question
自动整理对话|Save conversation notes
默认关闭。结束问题时整理为本机笔记。|Off by default. Save a local note when a conversation ends.
高级连接设置|Advanced connection settings
已为你预填 DeepSeek Flash。填写密钥后，就能围绕原文提问。|DeepSeek Flash is ready to configure. Connect your key to ask about your reading.
模型名称|Model
输入你的密钥，仅在本次页面内保存|Enter a key for this page session only
在本机加密保存密钥|Store the key encrypted on this device
从文件导入密钥|Import key from file
清除已配置密钥|Remove configured key
启用深度思考（可能需要更长时间）|Enable reasoning (may take longer)
测试连接|Test connection
保存设置|Save connection
DeepSeek 官方模型文档 ↗|DeepSeek model documentation ↗
关闭文档|Close document
关闭设置|Close settings
文献库|Library
学习台首页|Folio home
工作区|Workspace
应用菜单|Application menu
设置分类|Settings categories
搜索标题或文件夹|Search titles or folders
搜索文献|Search library
资料库分类|Library collections
全部文献|All documents
最近阅读|Recently read
已收藏|Favorites
笔记|Notes
本地文件夹|Local folders
刷新文献库|Refresh library
尚未连接|Not connected
连接文件夹|Connect folder
本地文献库|Local library
文件只保存在你的设备上|Files stay on your device
打开|Open
导入|Import
文献显示方式|Library view
网格视图|Grid view
列表视图|List view
双击文献开始阅读|Double-click a document to read
文献排序|Sort documents
最近阅读优先|Recently read first
按名称排列|Sort by name
标题|Title
格式|Type
位置|Location
文献列表|Document list
导读|Guide
内置示例|Built-in example
本地副本|Local copy
收藏的文献会出现在这里。|Your favorite documents appear here.
还没有阅读记录。|No reading history yet.
没有找到文献。|No documents found.
按书籍、页码和问题回看学习过程|Revisit your learning by book, page and question
默认关闭。开启后，换选段、新建动画、换书或离开阅读时，将当前对话整理为本机笔记；笔记不会自动带入其它问题。|Off by default. When enabled, switching passages, visualizations or books saves the conversation as a local note. Notes are not automatically included in other questions.
搜索书籍、问题或笔记内容|Search books, questions or notes
搜索笔记|Search notes
笔记列表|Note list
笔记详情|Note details
打开原文|Open source
重新连接原文|Reconnect source
导出这条笔记|Export note
编辑笔记|Edit note
删除笔记|Delete note
保存修改|Save changes
引用原文|Source passage
可视化记录|Visualization record
没有匹配的笔记。|No matching notes.
还没有笔记。可以手动保存解读，或开启自动整理。|No notes yet. Save an explanation or enable conversation notes.
选择一条笔记，查看问题、原文与对话。|Select a note to view its question, source and conversation.
这条笔记已不存在，其他笔记仍可查看。|This note no longer exists. Other notes are still available.
切换文献|Switch document
上一页|Previous page
下一页|Next page
当前页|Current page
缩小|Zoom out
放大|Zoom in
适合宽度|Fit width
解读选段|Explore selection
批注|Annotations
高亮|Highlight
下划线|Underline
便笺|Page note
高亮选中文字|Highlight selection
为选中文字加下划线|Underline selection
为选文或当前页添加便笺|Add a note to this selection or page
关闭批注侧栏|Close annotations
搜索摘录或评论|Search excerpts or comments
搜索当前文献批注|Search document annotations
汇总为笔记|Create note from annotations
导出|Export
撤销删除|Undo deletion
选中文字，点击「引用选段」或拖到右侧|Select text, then explore it or drag it to the right
保存当前阅读位置|Save reading position
记住页码|Save position
画布|Canvas
实验|Experiments
对话|Conversation
学习区|Learning area
新问题|New question
新问题 · 清空当前对话|New question · clear this conversation
描述你想看懂的内容…|What would you like to understand?
向 AI 提问|Ask AI
发送问题|Send question
停止|Stop
移除引用|Remove quote
参考本书原文|Use document context
自动整理：关闭|Conversation notes: Off
自动整理：开启|Conversation notes: On
收起 AI 辅助|Hide AI panel
展开 AI 辅助|Show AI panel
展开画布|Expand canvas
返回分栏阅读|Return to split view
选段可视化|Explore a passage
选中原文，或直接问我。|Select a passage or ask a question.
留住自己的理解|Keep what you learn
导出 Markdown ↗|Export Markdown ↗
本机服务已托管密钥，无需填写|Key managed by the local service
输入新密钥；留空保留已配置密钥|Enter a new key; leave blank to keep the current key
密钥由本机服务在内存中托管，不返回页面、不写入浏览器存储，仅用于 DeepSeek 官方地址。原始密钥文件仍保留在你的设备上。|The local service holds the key in memory. It is never returned to the page or saved in browser storage, and is used only with the official DeepSeek endpoint. The original key file remains on your device.
书籍留在本地。发送问题时，所选原文和当前对话会发送到你配置的模型服务；启用「自动参考原文」时也会发送当前文献的相关段落。密钥不会写入文件或浏览器存储。|Books stay local. Questions send the selected passage and current conversation to your model service. Document context includes relevant passages. The key is not written to files or browser storage.
密钥交给桌面主进程使用，保存后立即清空输入框。默认只在本次运行有效；勾选本机保存后使用 Windows 加密。只向 DeepSeek 官方地址发送。提问时发送选段；启用“自动参考原文”时发送当前文献的相关段落。自动整理的笔记只保存在本机。|The desktop process handles the key and clears this field after saving. Keys last for this session unless encrypted storage is enabled. Requests go only to the official DeepSeek endpoint and include your passage and optional document context. Conversation notes stay local.
正在连接模型…|Connecting to model…
已清除密钥。|Key removed.
未导入密钥。|No key imported.
密钥已导入，可点击测试连接。|Key imported. You can now test the connection.
先在左侧选中一段文字。|Select a passage in the reader first.
已存入笔记|Saved to notes
正在理解原文|Reading the passage
关闭|Close
删除|Delete
保存|Save
选择|Select
数学实验|Math experiments
每一步都在本机计算，可以反复尝试。|Each step is computed locally. Try it as often as you like.
置换的作用|Permutation action
可解群 · 导出列|Solvable groups · Derived series
三个元素，一次置换|Three elements, one permutation
顺序，会改变结果吗？|Does the order matter?
从一个群出发|Start with a group
重置|Reset
展开这一层的元素|Explore the elements
计算下一层 →|Compute next step →
＋ 把这次实验存为笔记|Save experiment as a note
↺ 回到恒等置换|Reset to the identity
选择对称群|Choose a symmetric group
展开 AI 辅助|Show AI panel
支持 PDF、TXT、Markdown|Supports PDF, TXT and Markdown
`.trim().split('\n').map(line=>line.split('|')));
export function resolveLanguage(choice, system='en'){return choice==='en'?'en':choice==='zh-CN'?'zh-CN':/^zh\b/i.test(system)?'zh-CN':'en';}
export function translate(text,lang){return lang==='en'?(dictionary[text]??text):text;}
let choice='system';try{choice=localStorage.getItem('folio-language')||'system';}catch{}
export function language(){return resolveLanguage(choice,navigator.language);}
export function t(zh){return translate(zh,language());}
export function languageChoice(){return choice;}
const textHistory=new WeakMap(),attrHistory=new WeakMap();
const protectedContent='#documentContent,.reading-answer,.notebook-prose,.note-editor,.annotation-excerpt,.note-card>p,.note-card>h3,#notebookDetail>h2,#notebookDetail details p,#notebookDetail details h3,#notebookDetail pre,.notebook-item strong,.note-breadcrumb,#documentTitle,#readerTabTitle,.document-name,.document-location,#folderTree button,#folderName,#quoteText,#quoteSource,#conversationTopic,#sourceContext,#analysisSummary,#visualStage>:not(.canvas-empty):not(.visual-loading):not(.visual-error),#messages,textarea,input,script,style,code,pre,[contenteditable="true"],[data-no-i18n]';
function updateValue(value,history){const original=history&&value===history.last?history.original:value;const core=original.trim();const translated=t(core);return {original,last:translated===core?original:original.replace(core,translated)};}
export function localize(root=document.body){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){if(!node.parentElement||node.parentElement.closest(protectedContent))continue;const record=updateValue(node.nodeValue,textHistory.get(node));textHistory.set(node,record);if(node.nodeValue!==record.last)node.nodeValue=record.last;}
 for(const el of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')]){
  if(!(el instanceof Element)||el.closest('#documentContent,.document-name,[contenteditable="true"],[data-no-i18n]'))continue;
  const records=attrHistory.get(el)||{};
  for(const name of ['title','aria-label','placeholder']){if(!el.hasAttribute(name))continue;const r=updateValue(el.getAttribute(name),records[name]);records[name]=r;if(r.last!==el.getAttribute(name))el.setAttribute(name,r.last);}
  attrHistory.set(el,records);
 }
}
export function setLanguage(value){if(!['system','zh-CN','en'].includes(value))return;choice=value;try{localStorage.setItem('folio-language',choice);}catch{}document.documentElement.lang=language();localize();window.dispatchEvent(new Event('folio-language'));window.folioDesktop?.setLanguage(language()).catch(()=>{});}
export function startLocalization(){
 setLanguage(choice);
 let pending=false;const observer=new MutationObserver(records=>{
  if(!records.some(r=>{const el=r.target.nodeType===3?r.target.parentElement:r.target;return !el.closest?.(protectedContent);}))return;
  if(pending)return;pending=true;queueMicrotask(()=>{pending=false;observer.disconnect();localize();observe();});
 });
 const observe=()=>observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});observe();
}
