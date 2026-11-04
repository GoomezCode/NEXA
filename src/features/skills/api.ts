import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';
import { createId } from '@/lib/id';
import { normalizeTags } from '@/lib/tags';
import { namespace } from '@/lib/namespace';
import { isOfflineMode } from '@/stores/connection-store';
import { useAuthStore } from '@/stores/auth-store';
import { skillLimitFor, SkillLimitError } from './limits';

export interface SkillEntry { id: string; name: string; description: string; instructions: string; tags: string[]; enabled: boolean; createdAt: string; updatedAt: string }
export type SkillInput = Pick<SkillEntry, 'name' | 'description' | 'instructions' | 'tags'>;
export const SKILL_LIMITS = { name: 60, description: 200, instructions: 4000, tags: 8, tag: 24 } as const;
export const SKILL_BASE_TAG = 'skill';
const key = (ns: string) => `nexa:skills:v1:${ns}`;
const cache = new Map<string, SkillEntry[]>();
const queues = new Map<string, Promise<void>>();
export const skillKeys = { all: (ns: string) => ['skills', ns] as const };
export function normalizeSkillTags(values: string[]): string[] { return normalizeTags(values, { maxTags: SKILL_LIMITS.tags, maxLength: SKILL_LIMITS.tag, required: [SKILL_BASE_TAG] }); }
function valid(x: unknown): x is SkillEntry { if (!x || typeof x !== 'object') return false; const e=x as Partial<SkillEntry>; return typeof e.id==='string' && typeof e.name==='string' && typeof e.instructions==='string' && Array.isArray(e.tags); }
async function list(ns=namespace()) { if (cache.has(ns)) return cache.get(ns)!; let raw: unknown; try { raw=await get(key(ns)); } catch { raw=[]; } const payload=raw&&typeof raw==='object'&&!Array.isArray(raw)&&'items' in raw?(raw as {items:unknown}).items:raw; const arr=Array.isArray(payload) ? payload.filter(valid).map(e=>({...e,name:e.name.trim().slice(0,60),description:(e.description??'').slice(0,200),instructions:e.instructions.slice(0,4000),tags:normalizeSkillTags(e.tags),enabled:e.enabled!==false})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)) : []; cache.set(ns,arr); return arr; }
async function persist(ns:string, items:SkillEntry[]) { const q=(queues.get(ns)??Promise.resolve()).catch(()=>{}).then(()=>set(key(ns),{v:1,items})); queues.set(ns,q); await q; }
export async function listSkills() { return (await list()).map(x=>({...x,tags:[...x.tags]})); }
export async function createSkill(input:SkillInput) { const ns=namespace(); const items=await list(ns); const role=useAuthStore.getState().session?.role??null; const limit=skillLimitFor({offline:isOfflineMode(),role}); if(limit!==null && items.length>=limit) throw new SkillLimitError(limit); const now=new Date().toISOString(); const e:SkillEntry={id:createId('skill'),name:input.name.trim().slice(0,60),description:input.description.trim().slice(0,200),instructions:input.instructions.trim().slice(0,4000),tags:normalizeSkillTags(input.tags),enabled:true,createdAt:now,updatedAt:now}; if(!e.name||!e.instructions) throw new Error('Preencha nome e instruções.'); items.unshift(e); cache.set(ns,items); await persist(ns,items); return e; }
export async function updateSkill(id:string,input:SkillInput) { const ns=namespace(),items=await list(ns), i=items.findIndex(x=>x.id===id); if(i<0) throw new Error('Skill não encontrada.'); items[i]={...items[i]!,...input,name:input.name.trim().slice(0,60),description:input.description.trim().slice(0,200),instructions:input.instructions.trim().slice(0,4000),tags:normalizeSkillTags(input.tags),updatedAt:new Date().toISOString()}; cache.set(ns,items); await persist(ns,items); return items[i]!; }
export async function setSkillEnabled(id:string,enabled:boolean) { const ns=namespace(),items=await list(ns),e=items.find(x=>x.id===id); if(!e) throw new Error('Skill não encontrada.'); e.enabled=enabled;e.updatedAt=new Date().toISOString();await persist(ns,items);return e; }
export async function deleteSkill(id:string) { const ns=namespace(),items=await list(ns),next=items.filter(x=>x.id!==id);cache.set(ns,next);await persist(ns,next); }
export async function clearSkillsStorage() { const namespaces=new Set([...cache.keys(),namespace()]); await Promise.all([...namespaces].map(ns=>del(key(ns)).catch(()=>undefined))); cache.clear(); queues.clear(); }
export function resetSkillsCacheForTests(){cache.clear();queues.clear();}
export function useSkills(){const ns=namespace();return useQuery({queryKey:skillKeys.all(ns),queryFn:()=>listSkills()});}
function useSkillMutation<TInput,TOutput>(fn:(v:TInput)=>Promise<TOutput>, update:(q:ReturnType<typeof useQueryClient>,v:TOutput)=>void){const q=useQueryClient();return useMutation({mutationFn:fn,onSuccess:v=>update(q,v)});}
export function useCreateSkill(){return useSkillMutation((v:SkillInput)=>createSkill(v),(q,v)=>q.setQueryData<SkillEntry[]>(skillKeys.all(namespace()),a=>[v,...(a??[])]));}
export function useUpdateSkill(){return useSkillMutation(({id,input}:{id:string;input:SkillInput})=>updateSkill(id,input),(q,v)=>q.setQueryData<SkillEntry[]>(skillKeys.all(namespace()),a=>[v,...(a??[]).filter(x=>x.id!==v.id)]));}
export function useSetSkillEnabled(){return useSkillMutation(({id,enabled}:{id:string;enabled:boolean})=>setSkillEnabled(id,enabled),(q,v)=>q.setQueryData<SkillEntry[]>(skillKeys.all(namespace()),a=>(a??[]).map(x=>x.id===v.id?v:x)));}
export function useDeleteSkill(){const q=useQueryClient();return useMutation({mutationFn:deleteSkill,onSuccess:(_v,id)=>q.setQueryData<SkillEntry[]>(skillKeys.all(namespace()),a=>(a??[]).filter(x=>x.id!==id))});}
