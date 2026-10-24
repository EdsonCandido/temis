# Features Webmin

Checklist dos módulos padrão do [Webmin](https://webmin.com/docs/) que o Temis pretende cobrir (ou já cobre) no painel.

Fonte: categorias oficiais (Webmin, System, Servers, Tools, Networking, Hardware, Cluster) e o catálogo do repositório [webmin/webmin](https://github.com/webmin/webmin). Docs por módulo: `https://webmin.com/docs/modules/<slug>/`.

## Como atualizar

Ao fechar um módulo, troque `- [ ]` por `- [x]` e preencha **Temis** com a tela ou rota que implementa.

Legenda:

- `[ ]` pendente
- `[x]` concluído

Escopo do Temis hoje: hosts (local/SSH), apps Docker/GitHub, nginx + TLS, métricas. Módulos marcados `[x]` cobrem o trabalho equivalente no produto — não são clone 1:1 da UI Perl do Webmin.

---

## Temis (fora do catálogo Webmin)

Funcionalidades próprias do painel, sem módulo Webmin correspondente.

- [x] Login do painel (`/login`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- [x] Hosts local e SSH (`/hosts`)
- [x] Painel: CPU, memória, disco, Docker (`/`)
- [x] Aplicações Docker e GitHub (`/apps`, `/apps/:id`)
- [x] Deploy, stop, restart, logs, destroy
- [x] Nginx por app: gzip, websocket, HSTS, www
- [x] TLS obrigatório: Let's Encrypt ou PEM próprio

---

## Webmin

Configuração do próprio painel.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [ ] | Configuração do Webmin | `webmin` | |
| [ ] | Usuários do Webmin | `acl` | login único; sem usuários/ACL |
| [ ] | Registro de ações | `webminlog` | |
| [ ] | Backup de arquivos de configuração | `backup-config` | |
| [ ] | Alterar idioma e tema | `change-user` | tema claro/escuro só na UI |
| [ ] | Configuração do Usermin | `usermin` | |
| [ ] | Funções agendadas do Webmin | `webmincron` | |
| [x] | Índice de servidores Webmin | `servers` | `/hosts` |

---

## System

Usuários, pacotes, cron, logs e estado da máquina.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [x] | Status do sistema | `system-status` | `/` métricas por host |
| [x] | Status do sistema e servidores | `status` | `/system/status` |
| [ ] | Usuários e grupos | `useradmin` | |
| [ ] | Usuários e grupos LDAP | `ldap-useradmin` | |
| [ ] | Alterar senhas | `passwd` | |
| [ ] | Autenticação PAM | `pam` | |
| [ ] | RBAC | `rbac` | |
| [ ] | Cotas de disco | `quota` | |
| [ ] | Sistemas de arquivos (disco e rede) | `mount` | |
| [ ] | Backup de sistemas de arquivos | `fsdump` | |
| [ ] | Tarefas Cron | `cron` | |
| [ ] | Comandos agendados (at) | `at` | |
| [ ] | Inicialização e desligamento | `init` | |
| [x] | Serviços Systemd | `systemd` | `/system/systemd` |
| [ ] | Níveis de execução (inittab) | `inittab` | |
| [ ] | SMF (Solaris) | `smf` | |
| [ ] | Pacotes de software | `software` | |
| [ ] | Atualizações de pacotes | `package-updates` | |
| [x] | Processos em execução | `proc` | `/system/proc` |
| [ ] | Hora do sistema | `time` | |
| [ ] | Logs do sistema (syslog) | `syslog` | |
| [ ] | Syslog-NG | `syslog-ng` | |
| [ ] | Visualizador de logs | `logviewer` | logs só da app em `/apps/:id` |
| [ ] | Rotação de logs | `logrotate` | |
| [ ] | Documentação do sistema (man) | `man` | |

---

## Servers

Servidores de aplicação, e-mail, DNS, banco e afins.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [x] | Nginx | `nginx` | vhost + TLS por app; sem editor completo |
| [ ] | Apache | `apache` | |
| [ ] | PHP (php.ini) | `phpini` | |
| [ ] | BIND DNS | `bind8` | |
| [ ] | DHCP (ISC) | `dhcpd` | |
| [ ] | Kea DHCP | `kea-dhcp` | |
| [ ] | SSH Server | `sshd` | |
| [ ] | Samba | `samba` | |
| [ ] | ProFTPD | `proftpd` | |
| [ ] | Squid | `squid` | |
| [ ] | MySQL / MariaDB | `mysql` | |
| [ ] | PostgreSQL | `postgresql` | |
| [ ] | SQLite | `sqlite` | |
| [ ] | LDAP Server | `ldap-server` | |
| [ ] | Postfix | `postfix` | |
| [ ] | Sendmail | `sendmail` | |
| [ ] | Qmail | `qmailadmin` | |
| [ ] | Exim | `exim` | |
| [ ] | Dovecot | `dovecot` | |
| [ ] | Fetchmail | `fetchmail` | |
| [ ] | Procmail | `procmail` | |
| [ ] | SpamAssassin | `spam` | |
| [ ] | Caixas de correio | `mailboxes` | |
| [ ] | Filtro de e-mail | `filter` | |
| [ ] | Webalizer | `webalizer` | |
| [ ] | SARG | `sarg` | |
| [x] | Fail2Ban | `fail2ban` | `/servers/fail2ban` |
| [ ] | Stunnel | `stunnel` | |
| [ ] | Minecraft | `minecraft` | |
| [ ] | inetd | `inetd` | |
| [ ] | xinetd | `xinetd` | |

---

## Tools

Utilitários do dia a dia.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [ ] | Terminal | `xterm` | |
| [ ] | Shell de comandos | `shell` | |
| [x] | Gerenciador de arquivos | `filemin` | `/tools/files` |
| [ ] | Upload e download | `updown` | |
| [ ] | Comandos personalizados | `custom` | |
| [ ] | Túnel HTTP | `tunnel` | |
| [ ] | Módulos Perl (CPAN) | `cpan` | |
| [ ] | Proteção de diretórios (htpasswd) | `htaccess-htpasswd` | |
| [ ] | Arquivo htpasswd | `htpasswd-file` | |
| [ ] | Mailcap | `mailcap` | |
| [ ] | Bacula Backup | `bacula-backup` | |

---

## Networking

Rede, firewall e VPN.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [ ] | Configuração de rede | `net` | |
| [x] | Firewall (iptables) | `firewall` | `/network/firewall` |
| [ ] | Firewall IPv6 (ip6tables) | `firewall6` | |
| [ ] | FirewallD | `firewalld` | |
| [ ] | nftables | `nftables` | |
| [ ] | Shorewall | `shorewall` | |
| [ ] | Shorewall6 | `shorewall6` | |
| [x] | IPFilter | `ipfilter` | `/network/ipfilter` |
| [ ] | IPFW | `ipfw` | |
| [ ] | Monitoramento de banda | `bandwidth` | |
| [ ] | Exportações NFS | `exports` | |
| [ ] | NFS (BSD) | `bsdexports` | |
| [ ] | NFS (HP-UX) | `hpuxexports` | |
| [ ] | NFS (SGI) | `sgiexports` | |
| [ ] | DFS | `dfsadmin` | |
| [ ] | NIS | `nis` | |
| [ ] | TCP Wrappers | `tcpwrappers` | |
| [ ] | IPsec VPN | `ipsec` | |
| [ ] | Kerberos 5 | `krb5` | |
| [ ] | IDMAPD | `idmapd` | |
| [ ] | LDAP Client | `ldap-client` | |
| [ ] | Cliente ADSL | `adsl-client` | |
| [ ] | Cliente PPP | `ppp-client` | |
| [ ] | PAP | `pap` | |
| [ ] | Cliente PPTP | `pptp-client` | |
| [ ] | Servidor PPTP | `pptp-server` | |
| [ ] | OpenSLP | `openslp` | |

---

## Hardware

Disco, RAID, boot e periféricos.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [ ] | Informações de hardware | `hardware-info` | |
| [ ] | Partições (fdisk) | `fdisk` | |
| [ ] | Partições BSD | `bsdfdisk` | |
| [ ] | Formatador de disco | `format` | |
| [ ] | LVM | `lvm` | |
| [ ] | Linux RAID | `raid` | |
| [ ] | SMART | `smart-status` | |
| [ ] | GRUB 2 | `grub2` | |
| [ ] | Impressoras | `lpadmin` | |
| [ ] | iSCSI Client | `iscsi-client` | |
| [ ] | iSCSI Server | `iscsi-server` | |
| [ ] | iSCSI Target | `iscsi-target` | |
| [ ] | iSCSI tgtd | `iscsi-tgtd` | |
| [ ] | Zonas (Solaris) | `zones` | |

---

## Cluster

Vários servidores a partir de um painel.

| Status | Módulo | Dir Webmin | Temis |
| --- | --- | --- | --- |
| [ ] | Cluster Webmin | `cluster-webmin` | |
| [ ] | Cluster Usermin | `cluster-usermin` | |
| [ ] | Cluster usuários | `cluster-useradmin` | |
| [ ] | Cluster senhas | `cluster-passwd` | |
| [ ] | Cluster Cron | `cluster-cron` | |
| [ ] | Cluster pacotes | `cluster-software` | |
| [ ] | Cluster cópia de arquivos | `cluster-copy` | |
| [ ] | Cluster shell | `cluster-shell` | |
| [ ] | Heartbeat | `heartbeat` | |

---

## Contagem

Atualize os números ao marcar um módulo.

| Grupo | Concluídos | Total |
| --- | --- | --- |
| Temis (próprio) | 7 | 7 |
| Webmin | 1 | 8 |
| System | 4 | 25 |
| Servers | 2 | 29 |
| Tools | 1 | 11 |
| Networking | 2 | 27 |
| Hardware | 0 | 14 |
| Cluster | 0 | 9 |
| **Módulos Webmin** | **10** | **123** |
