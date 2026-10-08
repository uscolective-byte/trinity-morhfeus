# Trinity PC Bridge 2.0

Lokálny klient bezpečne prepája Trinity Worker s používateľovým počítačom. Worker vytvára auditovanú akciu, zmenové operácie čakajú na samostatné schválenie a klient vracia potvrdenie s výsledkom alebo SHA-256 odtlačkom.

## Schopnosti

- čítanie a výpis súborov iba v povolených pracovných priečinkoch,
- vytvorenie, doplnenie a úprava súboru alebo adresára po schválení,
- otvorenie povolenej aplikácie a ovládanie aktívneho okna po schválení,
- screenshot, systémové informácie a notifikácie,
- bezpečné načítanie verejnej HTTP/HTTPS stránky,
- stiahnutie súboru do povoleného priečinka po schválení,
- Firecrawl, GitHub a nasadenie, ak sú osobitne nakonfigurované a schválené.

## Bezpečnostná politika

- `TRINITY_WORKSPACE_ROOTS` určuje povolené korene; všetky ostatné cesty sú odmietnuté.
- Kontrolujú sa aj symbolické odkazy, aby cesta neopustila workspace.
- `TRINITY_ALLOWED_APPS` obsahuje iba podporované aliasy aplikácií.
- Lokálne, loopback a privátne URL sú blokované; odpovede a downloady majú veľkostné limity.
- Ľubovoľný PowerShell je predvolene vypnutý (`TRINITY_ALLOW_SHELL=false`).
- Tajomstvá patria iba do lokálneho `.env` alebo chráneného správcu tajomstiev; necommitujú sa.

## Inštalácia a overenie

```powershell
cd trinity-pc-bridge
Copy-Item .env.example .env
# Doplň chránené hodnoty lokálne, nie do Git-u ani chatu.
npm test
npm start
```

Minimálne nastav `TRINITY_GATEWAY_KEY`, `TRINITY_URL` a `TRINITY_WORKSPACE_ROOTS`. Gateway kľúč musí zodpovedať Worker secretu. Voliteľné integrácie sa aktivujú iba prítomnosťou ich lokálnych premenných.
