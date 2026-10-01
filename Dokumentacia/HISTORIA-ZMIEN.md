# História zmien

## 1. október 2026

- Vytvorený hlavný priečinok `Morhfeus`.
- Presunutý produkčný projekt Trinity, prototypy, pracovné záznamy a technické referencie.
- Vizuálny koncept Living Core uložený do `Navrhy`.
- Pridaný režim pravdy s blokovaním nepodložených tvrdení o vykonaných akciách.
- Pridaný trvalý profil osobnosti bez predstierania vedomia alebo biologických emócií.
- Nainštalovaný register 11 modulov Trinity.
- Pridané nástroje na aktuálny čas a výpis nainštalovaných schopností.
- Aplikované databázové migrácie a nasadená verzia 6.3.0 na Cloudflare.
- Nainštalovaný Docker Desktop ako príprava izolovaného jazykového prostredia.
- Živý test režimu pravdy prešiel na oboch verejných adresách.
- Pridaný strojovo čitateľný checkpoint `stav-projektu.json` a návod `POKRACOVANIE.md` pre pokračovanie po obnovení limitu alebo v novom chate.
- Pridaná privátna lokálna brána so systémovými operáciami, oddeleným schválením a auditnými potvrdeniami; lokálne testy 7/7 a živý cloudový tok prešli.
- Hlavné rozhranie bolo prebudované na dashboard jednej Trinity s oddeleným Chatom, AI Studiom, Projektmi a Nastaveniami.
- AI Studio teraz reálne generuje weby, zobrazuje sandboxovaný živý náhľad, zachováva verzie v D1/R2 a exportuje HTML.
- V produkcii bol vytvorený a vizuálne overený ukážkový web Morhfeus.
- Vytvorený a nasadený Firebase projekt `trinity-morhfeus-20261001` so stavovým mostom na produkčnú Trinity.
- Codex MCP konfigurácia bola rozšírená o lokálny Trinity most a Firebase MCP server.
- Aplikované migrácie `0009` a `0010` a nasadená verzia 6.5.0; Worker testy prešli 37/37.
- Pôvodný `trinity-pc-bridge` bol nahradený bezpečným Durable Object Workerom s interným RPC, heartbeatom a secretom namiesto plain-text kľúča.
- Trinity 6.7.0 zrkadlí životný cyklus systémových akcií do PC Bridge a zobrazuje živý stav lokálnej brány.
- Lokálna brána 1.2.0 používa `qwen3:4b-instruct`, automatický štart a bezpečný zoznam desktopových operácií; testy prešli 8/8.
- End-to-end test Cloudflare → lokálny Qwen → Cloudflare prešiel a potvrdená desktopová akcia otvorila Kalkulačku.
