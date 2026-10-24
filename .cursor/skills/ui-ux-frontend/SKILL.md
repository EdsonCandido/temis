---
name: ui-ux-frontend
description: Planeja, constrói ou revisa interfaces Tailwind com padrão visual inspirado no Bootstrap, consistência de formulários, responsividade, acessibilidade e decisões corretas para notificações e confirmações.
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.html"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.css"
  - "**/*.ts"
---

# Skill: construir e revisar UI/UX frontend

Use esta skill ao criar uma tela nova, revisar uma interface considerada feia/desorganizada, padronizar componentes ou corrigir responsividade.

## Fluxo obrigatório

### 1. Diagnosticar o projeto
1. Identifique framework, versão do Tailwind (v3 ou v4), entrypoint CSS e estrutura dos componentes.
2. Localize componentes de botão, input, select, textarea, modal, toast, tabela e layout já existentes.
3. Descubra a biblioteca de ícones e componentes instalada e reutilize-a.
4. Identifique o fluxo de negócio da tela: objetivo, dados essenciais, ação principal, erros possíveis e estados de carregamento/vazio/sucesso.
5. Não substitua a arquitetura do projeto nem adicione dependência quando os componentes atuais forem suficientes.

### 2. Definir hierarquia e composição
1. Organize a página nesta ordem quando fizer sentido: navegação/contexto, título e descrição, ações principais, filtros, conteúdo, paginação e feedback.
2. Use um container alinhado e limite de largura coerente; aplique espaçamento sistemático, sem margens arbitrárias a cada elemento.
3. Dê destaque à informação mais importante e à ação principal. Reduza ruído visual, divisórias e cards sem função.
4. Agrupe campos e controles relacionados; use headings semânticos em ordem hierárquica.
5. Para telas de dados, mantenha filtros, resultados, estados vazios e paginação consistentes. Faça a tabela responsiva de verdade.

### 3. Aplicar tokens
- Tailwind v4: adapte `design-system/tailwind-v4-theme.css` ao CSS principal do projeto.
- Tailwind v3: adapte `design-system/tailwind.config.v3.example.ts` à configuração existente, preservando `content`, plugins e extensões.
- Não copie cegamente o arquivo de exemplo por cima de uma configuração real. Faça merge das cores e breakpoints necessários.
- Use a paleta semântica documentada em `design-system/paleta.md`. Não introduza novos hexadecimais locais sem motivo explícito.

### 4. Construir mobile-first
1. Faça a versão base funcional e legível na menor largura antes de adicionar breakpoints.
2. Use os breakpoints alinhados ao Bootstrap: `sm` 576px, `md` 768px, `lg` 992px, `xl` 1200px e `2xl` 1400px, se o projeto adotou a configuração deste kit.
3. Formulário: uma coluna no mobile; duas colunas a partir de `md` para campos adequados; três apenas para campos compactos e em telas largas.
4. Menu lateral vira drawer/menu colapsável no mobile; controles têm alvos de toque adequados; botões não são cortados nem ficam fora da tela.
5. Tabelas: reduza colunas secundárias ou use cards/overflow acessível. Não esconda informação crítica sem alternativa.
6. Verifique larguras próximas de 375px, 576px, 768px, 992px, 1200px e 1400px.

### 5. Normalizar componentes

**Inputs e selects**
- Altura base 40px (`h-10`), largura disponível, label visível acima, espaçamento uniforme, borda neutra e ring de foco.
- Mensagem de ajuda ou erro alinhada ao campo. Associe descrição/erro via `aria-describedby`.
- Use a mesma altura para todos os inputs/selects da mesma linha ou formulário.
- Textarea inicia em 96–120px e cresce conforme a necessidade do conteúdo.
- Campo compacto é exceção explícita para filtros ou tabelas densas.

**Botões**
- Altura usual 40px; tamanho touch principal pode chegar a 44px; compacto 32–36px apenas em contexto denso.
- Primário azul `#0d6efd`, secundário neutro com borda, sucesso verde para ações explicitamente positivas, warning amarelo com texto escuro e danger vermelho só para ações destrutivas.
- Inclua estado hover, focus-visible, disabled e loading. Previna envios duplicados.
- Use rótulos que descrevam o resultado da ação.

**Cards e superfícies**
- Use card quando houver grupo de conteúdo com uma fronteira conceitual; não coloque toda seção dentro de um card.
- Mantenha padding, raio, borda e elevação coerentes. Prefira bordas e sombras sutis em vez de sombras fortes.

### 6. Decidir feedback, modal e confirmação

| Situação | Padrão recomendado |
|---|---|
| Campo inválido | Mensagem inline no campo |
| Formulário não enviado por erro recuperável | Alert próximo ao formulário, preservando valores |
| Ação simples concluída, como salvar/atualizar | Toast de sucesso breve |
| Falha importante ou que exige providência | Alert persistente com próximo passo |
| Aviso informativo que não bloqueia o fluxo | Texto/banner contextual; toast somente se transitório |
| Edição rápida de poucos campos | Modal focado |
| Excluir/remover irreversivelmente | Modal de confirmação contextual |
| Fluxo longo, dados extensos, várias etapas ou URL própria | Página/rota, não modal |
| Revisão de muitos dados ou ação de alto impacto | Etapa de revisão com resumo antes de confirmar |
| Ação rotineira, reversível e de baixo risco | Sem confirmação extra; considere “Desfazer” |

Em toda confirmação, explique a consequência, nomeie o item afetado e use verbos claros. Para ações destrutivas, botão danger não substitui a confirmação quando o risco exige confirmação. Toast nunca deve ser o único lugar para uma falha crítica.

### 7. Acessibilidade e acabamento
- Garantir semântica, navegação por teclado, foco visível, labels e feedback compreensível.
- Usar texto com contraste WCAG AA; não comunicar estado apenas pela cor.
- Cobrir loading, empty, error e success conforme a funcionalidade.
- Evitar conteúdo pulando sem motivo, animações excessivas, gradientes decorativos e excesso de cores/ícones.
- Reaproveitar componentes ao invés de duplicar estilos ou criar uma segunda linguagem visual.

### 8. Validar e reportar
1. Revise a tela em mobile, tablet e desktop.
2. Procure overflow, alinhamentos inconsistentes, campos com alturas diferentes, botões sem hierarquia e conteúdo de baixo contraste.
3. Teste teclado/foco e o fluxo de modal/toast/erro relevante.
4. Execute lint, typecheck e build, se existirem no projeto.
5. Na resposta final, informe o que mudou, os tamanhos verificados, as verificações executadas e o que não foi possível verificar. Não declare testes como concluídos se não foram executados.

## Regra de decisão
Na dúvida, prefira o padrão mais simples, consistente e compreensível; não invente um novo padrão visual se um componente ou token existente já resolve o problema.
