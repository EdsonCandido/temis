# Helios Temis

Painel web para gerenciar aplicações numa VPS (ou na máquina local).

Você cadastra o host (local ou SSH), aponta a **imagem Docker** ou o **GitHub**, diz o **domínio**, e o Temis:

- sobe o container
- gera o nginx (TLS obrigatório: gzip, websocket, HSTS, www — ligue/desligue na UI)
- emite Let's Encrypt com renovação **ou** instala certificado próprio (PEM + chave)
- mostra CPU, memória, disco e `docker stats`

Você não edita nginx na mão.

## Requisitos no host alvo

- Docker
- nginx + certbot (Ubuntu/Debian: `scripts/bootstrap-vps.sh` como root)
- DNS do domínio apontando para o IP da VPS (A/AAAA)

## Subir o painel

```bash
cp .env.example .env
npm install
npm run dev:api   # http://127.0.0.1:3780
npm run dev:web   # http://127.0.0.1:5173
```

Login padrão (`.env`): `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Fluxo

1. **Hosts** — `local` se o Temis roda na VPS/notebook; `SSH` se o painel está na sua máquina e a VPS é remota (usuário + chave).
2. **Testar Docker** no host.
3. **Aplicações** — origem `docker` / `github` + modo de certificado (`Let's Encrypt` ou PEM próprio).
4. Abrir o app → **Deploy** (falha e remove o container se o certificado não ficar válido).
5. Ajustar opções de proxy na mesma tela e **Aplicar proxy**.

## Notas

- Container escuta só em `127.0.0.1`; a internet entra pelo nginx 80/443.
- Nenhuma app sobe sem certificado. Let's Encrypt precisa de DNS (A/AAAA) e porta 80 aberta.
- Certificado próprio: cole fullchain PEM + chave privada; renovação fica a cargo de você.
- SSH usa chave no caminho informado (arquivo na máquina onde o Temis API roda).
- Espaço em disco / memória: página **Painel**, por host.
