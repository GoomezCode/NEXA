import { normalizeSkillTags } from './api';
const stop = new Set('para com quando uma uns das dos que por pelo pela como ser ter sua seu mais menos isso essa este esta'.split(' '));
export function suggestSkillTags(name:string, description:string, instructions:string, existing:string[]=[]):string[]{
 const words=[...name.matchAll(/[\p{L}\p{N}]{3,}/gu),...description.matchAll(/[\p{L}\p{N}]{4,}/gu),...instructions.slice(0,500).matchAll(/[\p{L}\p{N}]{4,}/gu)].map(m=>m[0].toLowerCase()).filter(w=>!stop.has(w));
 const counts=new Map<string,number>();for(const w of words)counts.set(w,(counts.get(w)??0)+1);
 const canonical=new Map(existing.map(t=>[t.toLowerCase(),t]));
 return normalizeSkillTags([...counts.keys()].sort((a,b)=>(counts.get(b)!-counts.get(a)!)||a.localeCompare(b,'pt-BR')).slice(0,4).map(w=>canonical.get(w)??w));
}
