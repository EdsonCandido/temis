# Paleta de cores — Bootstrap 5.3 + Tailwind

## Direção principal

**Cor primária: azul Bootstrap `#0d6efd`.** Roxo/violeta não é usado como cor primária. Botões comuns usam azul; verde, ciano e amarelo têm semânticas específicas. Vermelho fica reservado para erros e ações destrutivas — não para o CTA padrão.

## Cores de tema

| Token | Hexadecimal | Uso recomendado |
|---|---|---|
| `primary` | `#0d6efd` | CTA principal, links, foco e seleção ativa |
| `primary-hover` | `#0b5ed7` | Hover do botão/link primário |
| `primary-active` | `#0a58ca` | Estado pressionado |
| `secondary` | `#6c757d` | Ação secundária, metadados e controles discretos |
| `success` | `#198754` | Operação positiva, ativação e confirmação de sucesso |
| `info` | `#0dcaf0` | Informação neutra; use texto escuro sobre o fundo ciano |
| `warning` | `#ffc107` | Atenção não destrutiva; use texto escuro |
| `danger` | `#dc3545` | Excluir, erro, risco ou ação destrutiva |
| `light` | `#f8f9fa` | Fundo neutro claro |
| `dark` | `#212529` | Texto e superfícies escuras pontuais, não CTA primário |
| `background` | `#f8f9fa` | Fundo geral da aplicação |
| `surface` | `#ffffff` | Cards, painéis, menus e formulários |
| `foreground` | `#212529` | Texto principal |
| `muted` | `#6c757d` | Texto secundário, ajuda e metadados |
| `border` | `#dee2e6` | Bordas de campos, divisórias e tabelas |
| `ring` | `#86b7fe` | Anel de foco para navegação por teclado |

## Regras de aplicação

- Use `bg-primary text-white` em CTAs genéricos, verificando contraste no contexto real.
- Use `bg-success text-white` apenas para ações com significado positivo explícito, como ativar/aprovar/concluir.
- Para warning e info, prefira fundos semânticos suaves (`warning-subtle`, `info-subtle`) e texto escuro.
- Para mensagens e banners, combine fundo sutil, borda e texto com significado da mesma família.
- Não use a cor como único indicador: inclua texto, ícone acessível ou outro sinal visual.
- Para texto normal, valide contraste WCAG AA (4.5:1). Os tokens são baseados no Bootstrap, mas nem todo par cor/texto tem contraste suficiente automaticamente.

## Exemplos de classes

```tsx
<button className="h-10 rounded-control bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
  Salvar alterações
</button>

<button className="h-10 rounded-control border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  Cancelar
</button>

<div className="rounded-card border border-success/30 bg-success-subtle p-4 text-foreground" role="status">
  Alterações salvas com sucesso.
</div>
```

> Nota: a sintaxe de tokens `rounded-control` e `rounded-card` funciona quando os raios correspondentes são configurados no tema Tailwind. Confira a configuração instalada antes de copiar os exemplos.
