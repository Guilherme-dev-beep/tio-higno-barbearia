# Tio Higno Barbearia — Site + Painel Admin

Projeto completo de agendamento para barbearia com visual premium.

## Como iniciar no VS Code

1. Extraia a pasta do projeto.
2. Abra a pasta `tio_higno_barbearia` no VS Code.
3. Abra o Terminal do VS Code.
4. Execute:
   ```bash
   npm install
   npm start
   ```
5. Abra no navegador:
   - Site: http://localhost:3000
   - Painel: http://localhost:3000/admin

## Acesso ao painel

A senha administrativa é armazenada no SQLite somente como hash. Altere-a em **Configurações > Segurança** depois de acessar o painel.

## Recursos incluídos

- Agendamento em 5 etapas
- Serviços e preços editáveis
- Escolha do barbeiro
- Disponibilidade por horário
- Prevenção de conflito de agenda
- Confirmação com código do agendamento
- Dashboard administrativo
- Agenda e filtros
- Concluir/cancelar atendimento
- Bloquear horários
- Cadastro/edição de serviços
- Cadastro/edição de barbeiros
- Base automática de clientes
- Faturamento de atendimentos concluídos
- Configurações da barbearia
- Alteração de senha do admin
- Layout responsivo para celular

## Dados

O SQLite em `data/tio_higno.sqlite` é a fonte de verdade em runtime. O arquivo `data/db.json` é apenas um seed legado usado somente quando o banco ainda não possui configurações.

## Produção na Railway

Configure manualmente um Volume persistente montado em `/data` e defina as variáveis:

```text
DATABASE_PATH=/data/tio_higno.sqlite
APP_TIMEZONE=America/Sao_Paulo
META_APP_SECRET=seu-segredo-da-meta
```

O `railway.json` deste projeto define build e start, mas não cria volumes persistentes. Sem esse Volume no painel da Railway, o filesystem do serviço pode ser recriado após um deploy.

## Hardening

- O painel administrativo usa sessão server-side em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O webhook da Meta exige `META_APP_SECRET` e valida `X-Hub-Signature-256`.
- Agendamentos ativos têm índice único por barbeiro, data e horário.
- Execute `npm test` para validar login, sessão, logout, concorrência, validações e webhook inválido em banco temporário.

Para produção, mantenha o SQLite em armazenamento persistente, use HTTPS, configure backups e forneça as credenciais oficiais do WhatsApp exclusivamente por variáveis de ambiente.
