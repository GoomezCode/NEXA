import { expect, test } from '@playwright/test';

test('o shell carrega a conversa inicial', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'NEXA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();
  await expect(page.getByText('núcleo online')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Painel do núcleo' })).toBeVisible();
});

test('envia uma mensagem e recebe a resposta do mock', async ({ page }) => {
  await page.goto('/');

  const textbox = page.getByRole('textbox', { name: 'Mensagem para a NEXA' });
  await textbox.fill('status do sistema');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();

  await expect(page.getByText('status do sistema')).toBeVisible();
  await expect(page.getByText(/Núcleo NEXA operacional/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();
});

test('cancela uma resposta em streaming', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Mensagem para a NEXA' }).fill('status do sistema');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();

  await page.getByRole('button', { name: 'Parar resposta' }).click();

  await expect(page.getByText('Resposta interrompida')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parar resposta' })).toBeHidden();
});

test('mostra o erro do adaptador e permite tentar novamente', async ({ page }) => {
  await page.goto('/?demoError=1');

  await page.getByRole('textbox', { name: 'Mensagem para a NEXA' }).fill('status do sistema');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();

  const conversation = page.getByRole('region', { name: 'Conversa' });

  await expect(
    conversation.getByText('Falha simulada no adaptador de demonstração.'),
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Tentar novamente' }).click();

  await expect(page.getByText(/Núcleo NEXA operacional/)).toBeVisible({ timeout: 10_000 });
  await expect(
    conversation.getByText('Falha simulada no adaptador de demonstração.'),
  ).toBeHidden();
});

test('mantém conversas e mensagens após recarregar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  const sidebar = page.locator('aside');

  await sidebar.getByRole('button', { name: 'Renomear Boas-vindas' }).click();
  const renameInput = page.getByRole('textbox', { name: 'Novo título da conversa' });
  await renameInput.fill('Sessão persistida');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Sessão persistida' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Mensagem para a NEXA' }).fill('status do sistema');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByText(/Núcleo NEXA operacional/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Sessão persistida' })).toBeVisible();
  await expect(page.getByText('status do sistema')).toBeVisible();
  await expect(page.getByText(/Núcleo NEXA operacional/)).toBeVisible();
});

test('busca, renomeia e exclui conversas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  const sidebar = page.locator('aside');

  await page.getByRole('button', { name: 'Criar nova conversa' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();

  const search = sidebar.getByRole('searchbox', { name: 'Buscar conversas' });
  await search.fill('inexistente');
  await expect(page.getByText('Nenhuma conversa encontrada.')).toBeVisible();
  await sidebar.getByRole('button', { name: 'Limpar busca' }).first().click();
  await expect(sidebar.getByRole('button', { name: /^Boas-vindas/ })).toBeVisible();

  await sidebar.getByRole('button', { name: 'Excluir Boas-vindas' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Excluir Boas-vindas' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(sidebar.getByRole('button', { name: /^Boas-vindas/ })).toBeVisible();

  await sidebar.getByRole('button', { name: 'Excluir Boas-vindas' }).click();
  await page
    .getByRole('alertdialog', { name: 'Excluir Boas-vindas' })
    .getByRole('button', { name: 'Excluir' })
    .click();

  await expect(sidebar.getByRole('button', { name: /^Boas-vindas/ })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
});

test('foca o compositor com Ctrl+K', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  const textbox = page.getByRole('textbox', { name: 'Mensagem para a NEXA' });
  await expect(textbox).not.toBeFocused();

  await page.keyboard.press('Control+k');
  await expect(textbox).toBeFocused();
});

test('avisa quando fica sem conexão', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText('Sem conexão · o modo demonstração continua local')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Sem conexão · o modo demonstração continua local')).toBeHidden();
});

test.describe('em viewport móvel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('abre o drawer de conversas', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Abrir conversas' }).click();

    const sheet = page.getByRole('dialog', { name: 'Conversas' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^Boas-vindas/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('navega pelo dock móvel', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('navigation', { name: 'Navegação móvel' })
      .getByRole('button', { name: 'Memória' })
      .click();

    await expect(page.getByRole('heading', { name: 'Memória', exact: true })).toBeVisible();
    await expect(page.getByText('Nenhuma memória ainda.')).toBeVisible();
  });
});
