# Atende AI

Assistente comercial com IA local para organizar leads e responder a mensagens recebidas pelo WhatsApp.

O projeto reúne um painel comercial, histórico de conversas e a assistente **Lia**, desenvolvida para apoiar o atendimento e a apresentação do Loja AI a potenciais clientes.

**Demonstração atual:** execução local no computador do autor.

## O problema

Acompanhar contatos em diferentes conversas dificulta recuperar o histórico, responder a perguntas recorrentes e identificar a etapa de cada oportunidade.

O Atende AI centraliza essas informações e utiliza o contexto das conversas para apoiar o atendimento.

## Funcionalidades implementadas

- Cadastro manual de leads.
- Identificação e criação de contatos pelo WhatsApp.
- Persistência de leads, conversas e mensagens no Supabase.
- Consulta de histórico e simulação de conversas com a IA.
- Classificação de intenção e atualização das etapas do funil.
- Respostas com Ollama e Qwen 2.5 3B.
- Regras comerciais para perguntas sobre preços, links e teste gratuito.
- Recebimento de mensagens de texto e áudio pelo WhatsApp Cloud API.
- Transcrição local de áudio com Faster Whisper.
- Envio automático de respostas em texto pela integração com a Meta.
- Configuração das informações comerciais e instruções da assistente.
- Monitor de atendimento em tempo real com Server-Sent Events (SSE).

O indicador de vendas conta leads classificados como `cliente`; ele não confirma pagamentos. A tela de conversas permite simulações e consulta de histórico, sem envio manual pelo WhatsApp.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript e Tailwind CSS 4 |
| Aplicação e API | Next.js 16, App Router e Route Handlers |
| Persistência | Supabase / PostgreSQL |
| IA de texto | Ollama e Qwen 2.5 3B |
| Transcrição | Python e Faster Whisper, modelo `small` |
| Mensageria | WhatsApp Cloud API / Meta Graph API |
| Monitoramento | SSE e eventos em memória |

## Como funciona

1. Uma mensagem chega pelo webhook do WhatsApp.
2. A aplicação identifica o contato e recupera seu histórico no Supabase.
3. Se houver áudio, o serviço Python realiza a transcrição.
4. Regras comerciais ou a IA geram uma resposta em texto.
5. A aplicação envia a resposta à Meta e registra a mensagem no histórico.
6. O painel acompanha as etapas do processamento por SSE.

Os áudios temporários são removidos após a tentativa de transcrição. O monitor mantém até 100 eventos na memória do processo e não substitui o histórico persistido no banco.

## Estrutura principal

```text
src/
  app/
    page.tsx
    configuracoes/page.tsx
    conversas/page.tsx
    api/
      configuracoes/route.ts
      conversas/route.ts
      ia/route.ts
      leads/route.ts
      monitor/route.ts
      whatsapp/webhook/route.ts
  lib/
    monitor.ts
transcricao_local.py
```

## Executar localmente

### Pré-requisitos

- Node.js e npm compatíveis com a versão do Next.js utilizada.
- Python e o pacote `faster-whisper`.
- Ollama com o modelo `qwen2.5:3b`.
- Projeto Supabase com as tabelas `leads`, `conversas`, `mensagens` e `configuracoes`.
- Uma configuração inicial do negócio cadastrada no banco.
- Para integrar o WhatsApp: credenciais da Meta, número habilitado e endereço HTTPS acessível para o webhook.

**O provisionamento SQL ainda precisa ser incluído no repositório.** Instalar as dependências não cria automaticamente as tabelas nem reproduz os dados do ambiente do autor.

### 1. Instalar as dependências

Na pasta do projeto, no PowerShell:

```powershell
npm.cmd ci
```

### 2. Configurar as variáveis de ambiente

Crie `.env.local` na raiz usando suas próprias credenciais:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SECRET_KEY=SUA_CHAVE_SECRETA_DO_SERVIDOR
WHATSAPP_ACCESS_TOKEN=SEU_TOKEN_DA_META
WHATSAPP_PHONE_NUMBER_ID=ID_DO_NUMERO
WHATSAPP_VERIFY_TOKEN=SEU_TOKEN_DE_VERIFICACAO
WHATSAPP_GRAPH_VERSION=v25.0
INTERNAL_APP_URL=http://127.0.0.1:3000
```

As variáveis do WhatsApp são necessárias para a integração com a Meta. A chave secreta do Supabase e o token da Meta devem permanecer no servidor. O arquivo `.env.local` está excluído do versionamento.

### 3. Preparar a IA local

Com o Ollama instalado, baixe o modelo e mantenha o serviço em execução:

```powershell
ollama pull qwen2.5:3b
```

A aplicação consulta o Ollama em `http://127.0.0.1:11434`.

### 4. Iniciar a transcrição

Em um ambiente Python próprio do projeto:

```powershell
python -m pip install faster-whisper
python transcricao_local.py
```

O serviço carrega o modelo `small` em CPU e escuta em `127.0.0.1:8765`. A primeira execução pode precisar baixar o modelo.

O processo Next.js e o serviço Python precisam ter acesso ao mesmo arquivo temporário de áudio.

### 5. Iniciar a aplicação

Em outro terminal:

```powershell
npm.cmd run dev
```

Acesse o endereço exibido no terminal. Se mudar a porta, atualize também `INTERNAL_APP_URL`.

Os pacotes dos launchers Windows e arquivos de execução local estão excluídos do repositório.

## Estado atual e próximas melhorias

- Implementar autenticação e autorização nas APIs do painel antes de disponibilizá-lo publicamente.
- Validar a assinatura dos eventos POST da Meta; a verificação GET do webhook já existe.
- Preparar uma demonstração separada, com dados fictícios.
- Implementar follow-ups: o cartão e a seção atuais são estáticos.
- Aplicar os preços das configurações em todas as respostas; a rota de IA ainda utiliza valores fixos.
- Versionar o esquema SQL e as dependências Python.
- Adicionar testes automatizados.
- Melhorar o tratamento de eventos em lote, concorrência e reenvio de webhooks.

## Validação

A compilação local foi concluída com `npm.cmd run build`.

A validação completa dos fluxos integrados ainda precisa ser documentada de forma reproduzível. O projeto ainda não inclui uma suíte de testes automatizados.

## Autor

**Jadson Freire de Mendonça** — Bacharel em Sistemas de Informação.

[GitHub](https://github.com/dinhomendonca-spa)
