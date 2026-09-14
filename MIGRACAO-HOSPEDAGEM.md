# Migração de hospedagem

Este projeto usa Node.js e SQLite persistente. A aplicação não depende da Railway: o caminho do banco é definido por `DATABASE_PATH`.

## 1. Preparar a origem

1. Coloque a aplicação em modo de manutenção ou pare o processo para impedir novas gravações.
2. Gere um backup consistente:

```bash
npm run db:backup
```

O arquivo será criado em `backups/tio-higno-YYYY-MM-DD-HHMM.sqlite`. O script usa `VACUUM INTO`, adequado para criar uma cópia consistente também quando o SQLite estiver usando WAL.

3. Guarde o backup fora do servidor de origem antes de continuar.

## 2. Configurar o destino

Instale Node.js compatível com a versão definida em `package.json` e configure:

```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=/data/tio-higno.sqlite
APP_TIMEZONE=America/Sao_Paulo
```

`/data` é apenas um exemplo de diretório persistente. Use o caminho fornecido pelo provedor de hospedagem. O diretório pai é criado automaticamente.

Não use filesystem temporário para o SQLite.

## 3. Transferir o banco

Copie o backup ou o banco validado para o caminho configurado em `DATABASE_PATH`. Preserve permissões de leitura e escrita para o usuário que executa o Node.js.

Não copie `data/db.json` sobre o banco existente. Ele é apenas um seed legado para uma instalação sem configurações.

## 4. Executar migrations

Com as gravações ainda paradas:

```bash
npm run db:migrate
npm run db:check
```

As migrations são independentes do provedor. Elas usam o arquivo indicado por `DATABASE_PATH` e preservam contagens, dados e foreign keys em transação.

## 5. Iniciar e validar

```bash
npm start
```

Depois valide:

1. `npm run db:check` retorna `integrity_check=ok` e `foreign_key_check=ok`.
2. O endpoint `/api/bootstrap` responde.
3. O login administrativo funciona.
4. A agenda abre no painel.
5. Um horário disponível pode ser consultado.
6. Um agendamento de teste pode ser criado e cancelado conforme o procedimento operacional do ambiente.
7. O processo pode ser reiniciado sem perder os dados.

## 6. Domínio e DNS

1. Mantenha o serviço antigo funcionando até o destino passar nos testes.
2. Configure o domínio personalizado no novo provedor.
3. Atualize o registro DNS conforme as instruções do provedor.
4. Aguarde a propagação e valide site, painel e API.
5. Só depois encerre o serviço antigo.

## 7. Rollback

Se houver falha:

1. Pare as gravações no destino.
2. Preserve os logs e o banco do destino para análise.
3. Reaponte o DNS para o serviço anterior.
4. Restaure o último backup conhecido como íntegro somente em uma cópia ou após confirmar o procedimento operacional.
5. Rode `npm run db:check` antes de aceitar novas gravações.

Nunca sobrescreva o único backup disponível.

## Checklist pós-deploy

- [ ] Abrir a URL pública e confirmar HTTP 200.
- [ ] Confirmar `/api/bootstrap` e os assets principais.
- [ ] Testar o site em 360px, 390px, 430px e 768px.
- [ ] Testar login administrativo.
- [ ] Confirmar endpoint admin protegido sem cookie com HTTP 401.
- [ ] Confirmar logout e nova resposta HTTP 401 após o logout.
- [ ] Criar um agendamento de teste.
- [ ] Confirmar o agendamento no painel.
- [ ] Cancelar o agendamento de teste.
- [ ] Testar conflito de horário com HTTP 409.
- [ ] Conferir logs sem senhas, tokens, cookies ou OTPs.
- [ ] Confirmar `DATABASE_PATH` apontando para o volume persistente.
- [ ] Confirmar o arquivo SQLite dentro do volume.
- [ ] Reiniciar o serviço.
- [ ] Confirmar que os dados continuam após o restart.
- [ ] Testar envio do WhatsApp.
- [ ] Validar webhook Meta com assinatura válida e inválida.
- [ ] Verificar ausência de erros HTTP 500.
- [ ] Executar `npm run db:check`.

## Rollback

1. Pare as gravações e coloque o serviço em manutenção.
2. Preserve logs e o banco atual para investigação.
3. Retorne o código para a versão anterior conhecida como estável.
4. Só restaure o banco usando o backup pré-deploy se houver evidência de corrupção ou migration incompatível.
5. Após qualquer restauração, execute `npm run db:check`.
6. Reinicie o serviço e valide login, agenda, agendamento e cancelamento.
7. Reabra as gravações somente depois das validações.

Backup pré-deploy desta rodada: `backups/pre-deploy-tio-higno-2026-09-14-0857.sqlite`.
