import { describe, expect, it } from 'vitest';
import { parseSkillMarkdown } from '@/features/skills/import/parse-skill-md';
import { readSkillFile, SKILL_FILE_MAX_BYTES } from '@/features/skills/import/read-skill-file';

function parsed(name:string,text:string) {
  const result=parseSkillMarkdown(name,text);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('importação de skill Markdown',()=>{
  it('lê frontmatter e corpo, ignora chaves extras e não transforma HTML',()=>{
    const skill=parsed('revisor.md','---\nname: Revisor de código\ndescription: Ao receber código, revisar\ntags: [código, revisão, python]\nlicense: MIT\n---\n<script>alert(1)</script> Revise código.');
    expect(skill).toMatchObject({name:'Revisor de código',description:'Ao receber código, revisar',tags:['código','revisão','python'],instructions:'<script>alert(1)</script> Revise código.'});
    expect(skill.warnings).toContain('1 campo ignorado: license');
  });
  it('usa o título, primeiro parágrafo e restante como instruções sem frontmatter',()=>{
    const skill=parsed('qualquer.md','# Revisor\n\nUse ao revisar código.\n\nListe bugs e correções.');
    expect(skill.name).toBe('Revisor');
    expect(skill.description).toBe('Use ao revisar código.');
    expect(skill.instructions).toBe('Liste bugs e correções.');
  });
  it('usa o nome do arquivo como fallback',()=>{
    expect(parsed('revisor_de-codigo.md','Revise o código com cuidado.\n\nAponte erros.').name).toBe('Revisor de codigo');
  });
  it('normaliza tags nos formatos inline, YAML em lista e string',()=>{
    expect(parsed('x.md','---\ntags: [Python, "código", python]\n---\nFaça isso.').tags).toEqual(['python','código']);
    expect(parsed('x.md','---\ntags:\n  - Python\n  - revisão\n---\nFaça isso.').tags).toEqual(['python','revisão']);
    expect(parsed('x.md','---\ntags: python, revisão\n---\nFaça isso.').tags).toEqual(['python','revisão']);
  });
  it('junta descrição YAML em blocos dobrado e literal',()=>{
    expect(parsed('x.md','---\ndescription: >\n  Linha um\n  Linha dois\n---\nInstruções').description).toBe('Linha um Linha dois');
    expect(parsed('x.md','---\ndescription: |\n  Linha um\n  Linha dois\n---\nInstruções').description).toBe('Linha um\nLinha dois');
  });
  it('aceita BOM, CRLF e valores entre aspas',()=>{
    const skill=parsed('x.md','\uFEFF---\r\nname: "Revisor\\" PT"\r\ndescription: \'Texto de teste\'\r\ntags: [\'Python\']\r\n---\r\nFaça.');
    expect(skill.name).toBe('Revisor" PT');
    expect(skill.description).toBe('Texto de teste');
  });
  it('avisa sobre truncamentos e excesso de tags',()=>{
    const long='x'.repeat(4100);
    const skill=parsed('x.md',`---\nname: ${'n'.repeat(70)}\ndescription: ${'d'.repeat(220)}\ntags: [a,b,c,d,e,f,g,h]\n---\n${long}`);
    expect(skill.name).toHaveLength(60);
    expect(skill.description).toHaveLength(200);
    expect(skill.instructions).toHaveLength(4000);
    expect(skill.warnings).toHaveLength(4);
  });
  it('rejeita corpo ausente e remove caracteres de controle',()=>{
    expect(parseSkillMarkdown('x.md','---\nname: X\n---\n').ok).toBe(false);
    expect(parsed('x.md','---\nname: X\n---\nOlá\u0001 mundo').instructions).toBe('Olá mundo');
    expect(parseSkillMarkdown('x.md','\0binário').ok).toBe(false);
  });
  it('valida extensão, tamanho, arquivo vazio e bytes inválidos',async()=>{
    expect((await readSkillFile(new File(['conteúdo'],'x.pdf')))).toMatchObject({ok:false,error:'Formato não suportado. Use um arquivo .md, .markdown ou .txt.'});
    expect(await readSkillFile(new File([''], 'vazio.md'))).toMatchObject({ok:false,error:'O arquivo está vazio ou não tem instruções.'});
    expect(await readSkillFile(new File(['\0x'], 'binario.txt'))).toMatchObject({ok:false,error:'Não foi possível ler o arquivo.'});
    const big=new File(['x'.repeat(SKILL_FILE_MAX_BYTES+1)],'grande.md');
    expect(await readSkillFile(big)).toMatchObject({ok:false,error:'Arquivo grande demais (máx. 100 KB).'});
  });
});
