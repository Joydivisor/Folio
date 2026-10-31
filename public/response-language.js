export function responseLanguageInstruction(preference='auto'){
 const language=preference==='en'?'Use English for explanations, titles and visualization labels.':preference==='zh-CN'?'Use Simplified Chinese for explanations, titles and visualization labels.':'Follow the language explicitly requested in the user question, otherwise match its language.';
 const content=language+' Preserve all source quotations verbatim, including their language. Follow the actual user question’s requested sentence count and length over generic template defaults. Return the requested JSON schema without translating field names.';
 return content;
}

export function withResponseLanguage(messages,preference='auto'){return [{role:'system',content:responseLanguageInstruction(preference)},...messages];}
