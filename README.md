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

## Acesso inicial do painel

- Senha: `admin123`
- Altere em **Configurações > Segurança**.

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

Os dados são gravados em `data/db.json`.

> Para uso comercial em produção, recomenda-se migrar o banco JSON para PostgreSQL/MySQL e implementar autenticação com senha criptografada, HTTPS, backups e integração oficial de WhatsApp/pagamentos.
