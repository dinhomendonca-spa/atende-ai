Atende AI
Assistente comercial com IA local para organizar leads e responder a mensagens recebidas pelo WhatsApp.

O Atende AI reúne um painel comercial, histórico de conversas e a assistente Lia. O projeto foi desenvolvido para apoiar o atendimento e a apresentação do Loja AI a potenciais clientes.

Demonstração: execução local no computador do autor. Esta versão ainda não oferece um painel público para avaliação.
O problema
Atender contatos por diferentes conversas dificulta acompanhar o histórico, responder a perguntas recorrentes e identificar em qual etapa está cada oportunidade.

O projeto centraliza os contatos e usa o contexto das conversas e informações comerciais para apoiar o atendimento.
Funcionalidades implementadas
- Cadastro manual de leads com dados de contato, interesse e observações.
- Identificação ou criação de leads a partir de mensagens recebidas no WhatsApp.
- Armazenamento de leads, conversas e mensagens no Supabase.
- Tela para consultar o histórico e simular uma conversa com a IA.
- Classificação de intenção e atualização de etapas do funil comercial.
- Geração de respostas com histórico da conversa usando Ollama e o modelo Qwen 2.5 3B.
- Respostas comerciais por regras para perguntas sobre preços, links e teste gratuito.
- Recebimento de texto e áudio pelo webhook do WhatsApp Cloud API.
- Transcrição local de áudio com Faster Whisper, seguida de geração e envio de resposta em texto.
- Configuração das informações do negócio e das instruções da assistente.
- Monitor de processamento em tempo real com Server-Sent Events (SSE).
O indicador de vendas conta leads classificados como cliente; ele não confirma pagamentos. A tela de conversas permite simulações locais e não representa uma ferramenta de envio manual de mensagens pelo WhatsApp.
Tecnologias
Camada	Tecnologias
Interface	React 19, TypeScript e Tailwind CSS 4
Aplicação e API	Next.js 16 com App Router e Route Handlers
Persistência	Supabase / PostgreSQL
IA de texto	Ollama e Qwen 2.5 3B
Transcrição	Python e Faster Whisper, modelo small
Mensageria	WhatsApp Cloud API / Meta Graph API
Monitoramento	SSE e eventos mantidos em memória


Como funciona
1. O WhatsApp envia um evento ao webhook da aplicação.
2. A aplicação consulta o Supabase para identificar o contato e recuperar o histórico.
3. Mensagens de áudio são baixadas temporariamente e transcritas pelo serviço Python local.
4. Regras comerciais ou a IA produzem a resposta em texto.
5. A resposta é enviada à Meta e registrada no histórico da conversa.
6. O painel acompanha as etapas do processamento por SSE.
Os arquivos de áudio temporários são removidos após a tentativa de transcrição. O monitor mantém até 100 eventos na memória do processo; ele não substitui o histórico persistido no banco.
Estrutura principal
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
Executar localmente
Pré-requisitos
- Node.js e npm compatíveis com a versão do Next.js do projeto.
- Python com o pacote faster-whisper instalado.
- Ollama com o modelo qwen2.5:3b disponível.
- Projeto Supabase provisionado com as tabelas leads, conversas, mensagens e configuracoes, incluindo uma configuração inicial do negócio.
- Para o fluxo do WhatsApp: configuração da Meta, número habilitado e um endereço HTTPS acessível para o webhook.
O provisionamento SQL ainda precisa ser incluído no repositório. Uma instalação apenas com as dependências não cria automaticamente as tabelas nem reproduz os dados do ambiente do autor.
1. Instalar as dependências da aplicação
Na pasta do projeto, no PowerShell:
npm.cmd ci
2. Configurar o ambiente
Crie um arquivo .env.local na raiz do projeto usando as suas próprias credenciais:
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SECRET_KEY=SUA_CHAVE_SECRETA_DO_SERVIDOR
WHATSAPP_ACCESS_TOKEN=SEU_TOKEN_DA_META
WHATSAPP_PHONE_NUMBER_ID=ID_DO_NUMERO
WHATSAPP_VERIFY_TOKEN=SEU_TOKEN_DE_VERIFICACAO
WHATSAPP_GRAPH_VERSION=v25.0
INTERNAL_APP_URL=http://127.0.0.1:3000
As variáveis do WhatsApp são necessárias para a integração com a Meta. A chave secreta do Supabase e o token da Meta devem permanecer no servidor. O arquivo .env.local está excluído do versionamento.
3. Preparar a IA local
Com o Ollama instalado, baixe o modelo e mantenha o serviço em execução:
ollama pull qwen2.5:3b
A aplicação consulta o Ollama em http://127.0.0.1:11434.
4. Iniciar a transcrição de áudio
Em um ambiente Python próprio do projeto:
python -m pip install faster-whisper
python transcricao_local.py
O serviço carrega o modelo small em CPU e escuta em 127.0.0.1:8765. A primeira execução pode precisar baixar o modelo. Ele é necessário para receber áudios pelo WhatsApp.
5. Iniciar a aplicação
Em outro terminal:
npm.cmd run dev
Use o endereço exibido no terminal. Se mudar a porta, atualize também INTERNAL_APP_URL. Na implementação atual, o processo Next.js e o serviço de transcrição precisam ter acesso ao mesmo arquivo temporário de áudio.

O atalho Windows usado pelo autor é um inicializador local. Os pacotes dos launchers e arquivos de execução não fazem parte do código publicado.
Estado atual e próximas melhorias
- Adicionar autenticação e autorização às APIs do painel antes de disponibilizá-lo publicamente.
- Validar a assinatura dos eventos POST recebidos da Meta; a verificação GET do webhook já está implementada.
- Criar um ambiente de demonstração com dados fictícios, separado da operação real.
- Implementar follow-ups: o cartão e a seção atuais são estáticos.
- Usar os preços salvos nas configurações em todas as respostas; a rota de IA ainda usa preços fixos no código.
- Versionar o esquema SQL e as dependências Python para facilitar a reprodução do ambiente.
- Acrescentar testes dos fluxos e melhorar o tratamento de eventos em lote, concorrência e reenvio de webhooks.
Validação
A compilação local foi concluída com npm.cmd run build. A validação completa dos fluxos integrados ainda precisa ser documentada de forma reproduzível. O projeto ainda não inclui uma suíte de testes automatizados.
Autor
Jadson Freire de Mendonça — Bacharel em Sistemas de Informação.