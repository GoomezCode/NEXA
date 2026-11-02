import { describe, expect, it } from 'vitest';
import { skillLimitFor } from '@/features/skills/limits';
import { suggestSkillTags } from '@/features/skills/tags';
import { selectRelevantSkills } from '@/features/skills/select';
import type { SkillEntry } from '@/features/skills/api';

const entry = (id:string, name:string, instructions:string, enabled=true, updatedAt='2026-01-01T00:00:00.000Z'):SkillEntry=>({id,name,description:'',instructions,tags:['skill',name.toLowerCase()],enabled,createdAt:updatedAt,updatedAt});

describe('regras de skills',()=>{
 it('aplica quotas por perfil e modo offline',()=>{
  expect(skillLimitFor({offline:false,role:'guest'})).toBe(2);
  expect(skillLimitFor({offline:false,role:'user'})).toBe(5);
  expect(skillLimitFor({offline:false,role:'admin'})).toBeNull();
  expect(skillLimitFor({offline:true,role:'guest'})).toBeNull();
 });
 it('sugere tags relevantes e sempre inclui skill',()=>{
  const tags=suggestSkillTags('Revisor de código Python','Ao revisar bugs de Python','Analise sintaxe e segurança');
  expect(tags[0]).toBe('skill');
  expect(tags).toContain('python');
  expect(tags).toContain('código');
 });
 it('seleciona somente skills ativas e respeita limite e orçamento',()=>{
  const skills=[entry('one','Python','Explique Python com exemplos.'),entry('two','JavaScript','Explique JavaScript.'),entry('off','Privada','Não incluir.',false)];
  expect(selectRelevantSkills(skills,'ajuda com python',{limit:1,budgetChars:1000})).toEqual([{name:'Python',instructions:'Explique Python com exemplos.'}]);
  expect(selectRelevantSkills(skills,'',{limit:null,budgetChars:4})).toEqual([]);
 });
});
