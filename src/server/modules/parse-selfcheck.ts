import assert from "node:assert/strict";
import { buildIgnoreIps, parseFail2banDump, parseSshClientIp } from "./fail2ban/service.js";
import { assertSafePath, parseListOutput } from "./filemin/service.js";
import { analyzeOpenRules, detectBasics, parseIptablesSave, parseSsListen } from "./firewall/analyze.js";
import { parseIptablesList } from "./firewall/service.js";
import { parseIpfilter } from "./ipfilter/service.js";
import { markKnownContainers, parseDockerInventory } from "../services/metrics.js";

const f2b = parseFail2banDump(`
===JAIL sshd===
|- Currently failed:	3
|- Total failed:	10
|- Currently banned:	1
|- Total banned:	4
\`- Banned IP list:	1.2.3.4 10.0.0.1
`);
assert.equal(f2b.available, true);
assert.equal(f2b.reason, null);
assert.equal(f2b.jails[0]?.name, "sshd");
assert.deepEqual(f2b.jails[0]?.banned, ["1.2.3.4", "10.0.0.1"]);

assert.equal(parseSshClientIp("SSH_CLIENT=203.0.113.10 51234 22"), "203.0.113.10");
assert.deepEqual(buildIgnoreIps(["203.0.113.10", "not-an-ip"]), ["127.0.0.1/8", "::1", "203.0.113.10"]);
assert.equal(parseFail2banDump("TEMIS_F2B_MISSING").reason, "missing");
assert.equal(parseFail2banDump("TEMIS_F2B_STOPPED").reason, "stopped");

const fw = parseIptablesList(`
Chain INPUT (policy ACCEPT 0 packets, 0 bytes)
num   pkts bytes target     prot opt in     out     source               destination
1        4   240 ACCEPT     tcp  --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:22
Chain FORWARD (policy DROP 0 packets, 0 bytes)
num   pkts bytes target     prot opt in     out     source               destination
Chain OUTPUT (policy ACCEPT 0 packets, 0 bytes)
num   pkts bytes target     prot opt in     out     source               destination
`);
assert.equal(fw.chains.length, 3);
assert.equal(fw.chains[0]?.rules[0]?.target, "ACCEPT");
assert.equal(fw.chains[0]?.rules[0]?.extra, "tcp dpt:22");

const save = parseIptablesSave(`[12:80] -A ufw-user-input -p tcp --dport 3306 -j ACCEPT`);
assert.equal(save[0]?.target, "ACCEPT");
assert.equal(detectBasics(save).ssh, false);
const listens = parseSsListen("tcp   LISTEN 0 128 0.0.0.0:3306 0.0.0.0:*");
assert.equal(listens[0]?.publicBind, true);
const findings = analyzeOpenRules(fw.chains, save, listens);
assert.ok(findings.some((f) => f.level === "risk" && f.port === 3306));

const listed = parseListOutput('{"path":"/tmp","entries":[{"name":"a","kind":"file","size":1,"mtime":1,"mode":"644"}]}');
assert.ok(!("error" in listed));
if (!("error" in listed)) assert.equal(listed.entries[0]?.name, "a");

assert.throws(() => assertSafePath("/tmp/../etc/passwd"));

const ipf = parseIpfilter(`---VERSION---
IP Filter: Version 5.1.2
---RULES---
empty list for ipfilter (in)
@1 pass out proto tcp from any to any
`);
assert.equal(ipf.available, true);
assert.equal(ipf.rules[0]?.side, "out");

const dockerInv = parseDockerInventory(`
DOCKER_OK
---PS---
temis-loja|running|Up 2 hours|ghcr.io/acme/loja:1
redis-cache|exited|Exited (0) 3 days ago|redis:7
---STATS---
temis-loja|1.20%|120MiB / 2GiB|6.00%
`);
assert.equal(dockerInv.length, 2);
assert.equal(dockerInv.find((c) => c.name === "redis-cache")?.status, "exited");
const tagged = markKnownContainers(dockerInv, [{ name: "Loja", slug: "loja", containerName: "temis-loja" }]);
assert.equal(tagged.find((c) => c.name === "temis-loja")?.known, true);
assert.equal(tagged.find((c) => c.name === "redis-cache")?.known, false);

const dockerJson = parseDockerInventory(`
---PS---
{"Names":"/n8n","State":"running","Status":"Up 4 hours","Image":"n8nio/n8n:latest"}
{"Names":"temis-loja","State":"running","Status":"Up 2 hours","Image":"ghcr.io/acme/loja:1"}
---STATS---
/n8n|2.10%|210MiB / 2GiB|10.00%
`);
assert.equal(dockerJson.length, 2);
assert.equal(dockerJson.find((c) => c.name === "n8n")?.image, "n8nio/n8n:latest");
assert.equal(dockerJson.find((c) => c.name === "n8n")?.cpu, "2.10%");
const jsonTagged = markKnownContainers(dockerJson, [{ name: "Loja", slug: "loja", containerName: "temis-loja" }]);
assert.equal(jsonTagged.find((c) => c.name === "n8n")?.known, false);
assert.equal(jsonTagged.find((c) => c.name === "temis-loja")?.known, true);

const dockerPipe3 = parseDockerInventory(`
---PS---
portainer|Up 8 hours|portainer/portainer-ce
`);
assert.equal(dockerPipe3[0]?.name, "portainer");
assert.equal(dockerPipe3[0]?.image, "portainer/portainer-ce");

console.log("parse-selfcheck ok");
