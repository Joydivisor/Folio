// These preferences select a representation, never infer experimental parameters.
export function preferredReadingKind(question=''){
 const q=String(question);
 if(/(?:只|仅)(?:用|需|要)?[^。\n]{0,8}(?:文字|一句|解释)|(?:text|prose) only|only (?:text|prose)|no (?:diagrams|visuals)/i.test(q))return 'explain';
 if(/comparison|对比表|比较|对比|区别|compare|difference between/i.test(q))return 'comparison';
 if(/derivation|分步推导|逐步证明|证明|拉格朗日定理|prove|proof|derive/i.test(q))return 'derivation';
 if(/process|分步过程|流程|step.by.step process/i.test(q))return 'process';
 if(/(?:σ|τ|\\sigma|\\tau)\s*=\s*\(\s*[1-8](?:[\s,，]+[1-8])+\s*\)/u.test(q))return 'permutation';
 if(/(?:S[₃₄₅345]|S_\{?[345]).*(?:可解|导出|交换子)/i.test(q))return 'derived';
 return null;
}
