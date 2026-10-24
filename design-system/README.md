# UI/UX kit para Cursor + Tailwind

Kit para padronizar telas e componentes com a organização semântica do Bootstrap 5.3 e implementação nativa em Tailwind CSS.

## Conteúdo

- `.cursor/rules/ui-ux-design-system.mdc`: regra de aplicação contínua para o Cursor.
- `.cursor/skills/ui-ux-frontend/SKILL.md`: fluxo detalhado para construir/revisar interfaces, acionável com `/ui-ux-frontend` ou pelo seletor de skills.
- `design-system/paleta.md`: tokens, semântica das cores e exemplos de classes.
- `design-system/tailwind-v4-theme.css`: tema para projetos com Tailwind v4.
- `design-system/tailwind.config.v3.example.ts`: exemplo de tema para Tailwind v3.

## Como instalar no seu projeto

1. Copie a pasta `.cursor/` deste kit para a raiz do repositório. Preserve regras que já existam em vez de sobrescrevê-las.
2. Copie `design-system/` para a raiz do repositório.
3. Confira a versão do Tailwind no `package.json`.
4. **Tailwind v4:** integre o conteúdo de `tailwind-v4-theme.css` ao CSS principal (geralmente `src/index.css`, `src/app.css` ou equivalente). Não mantenha dois `@import "tailwindcss"` sem necessidade.
5. **Tailwind v3:** mescle `tailwind.config.v3.example.ts` com o arquivo atual. Preserve caminhos em `content`, plugins e extensões já utilizadas. Reinicie o servidor de desenvolvimento depois de alterar a configuração.
6. Faça uma revisão inicial dos componentes comuns (Button, Input, Select, Textarea, Modal/Dialog, Toast/Alert, Table e PageHeader) para que os tokens e tamanhos sejam aplicados de verdade.

## Padrão de responsividade

Este kit usa os breakpoints do Bootstrap como convenção da aplicação: `sm` 576px, `md` 768px, `lg` 992px, `xl` 1200px e `2xl` 1400px. O Tailwind é mobile-first: classes sem prefixo são a base móvel; `md:grid-cols-2`, por exemplo, começa em 768px.

## Tamanhos de controle

- Input/select/botão: 40px (`h-10`).
- Botão compacto, quando justificado: 32–36px.
- Botão principal com maior alvo de toque, quando necessário: 44px.
- Textarea: 96–120px de altura inicial.

Não adicione `h-10` indiscriminadamente a componentes especiais, como upload, date picker composto ou controles fornecidos por bibliotecas. Nesses casos, alinhe o contêiner visível com a altura padrão e preserve acessibilidade e comportamento.

## Referências oficiais

- Cursor Rules: https://cursor.com/docs/rules
- Cursor Skills: https://cursor.com/help/customization/skills
- Bootstrap 5.3 Colors: https://getbootstrap.com/docs/5.3/customize/color/
- Bootstrap 5.3 Breakpoints: https://getbootstrap.com/docs/5.3/layout/breakpoints/
- Tailwind Responsive Design: https://tailwindcss.com/docs/responsive-design
- Tailwind Theme Variables: https://tailwindcss.com/docs/theme
