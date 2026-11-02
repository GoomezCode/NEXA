import type { SkillEntry } from './api';
export interface PersonalizationSkill { name:string; description?:string; instructions:string }
export function selectRelevantSkills(skills:SkillEntry[], message:string, options:{limit:number|null;budgetChars:number}) {
 const terms=new Set(message.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]{3,}/gu)??[]);
 const active=skills.filter(x=>x.enabled).slice(0, options.limit??Infinity).map((skill,index)=>{const search=[skill.name,skill.description,...skill.tags].join(' ').toLocaleLowerCase('pt-BR');const score=[...terms].reduce((n,t)=>n+(search.includes(t)?2:0)+(skill.instructions.toLocaleLowerCase('pt-BR').includes(t)?1:0),0);return {skill,index,score};}).sort((a,b)=>b.score-a.score||b.skill.updatedAt.localeCompare(a.skill.updatedAt)||a.index-b.index);
 const selected:PersonalizationSkill[]=[];let used=0;for(const {skill} of active){if(used>=options.budgetChars)break;const name=skill.name.slice(0,60),description=skill.description.slice(0,200),prefix=name.length+description.length;const instructions=skill.instructions.slice(0,Math.max(0,Math.min(4000,options.budgetChars-used-prefix)));if(!instructions)continue;selected.push({name, ...(description?{description}:{}),instructions});used+=prefix+instructions.length;}return selected;
}
