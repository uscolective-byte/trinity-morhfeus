# Gemini Gem a Trinity

## Čo je prepojené

Trinity používa Gemini cez svoj serverový Gemini API klient. Agent `gemini-gem`
posiela systémový profil a správu do Gemini API, skúša nakonfigurovanú kaskádu
modelov a môže prejsť na Cloudflare Workers AI. Fallback ani názov agenta
nezaručujú dostupnosť, nulový výpadok alebo neobmedzenú kvótu.

Systémový profil v `src/gemini-gem-agent.js` je lokálne verzovaná adaptácia
kontextu dostupného v opise používateľovho Gemini Gemu: Trinity je modulárny
AI systém; deklarované komponenty a konfigurácia nie sú samy dôkazom živého
spojenia; každé tvrdenie o vykonaní potrebuje skutočný výsledok. V Gemini Gem
editore bolo pole vlastných inštrukcií prázdne a neboli pripojené znalostné
súbory, preto Trinity nepreberá žiadne skryté Gem inštrukcie ani súbory.

## Čo toto prepojenie nerobí

- Gemini API `generateContent` prijíma názov modelu a požiadavku; ID Gemu z
  Gemini webového rozhrania nie je ID modelu ani ID API Managed Agentu.
- Trinity týmto spôsobom nevie načítať alebo spustiť presne ten Gem z odkazu.
- Agent v Trinity momentálne vykonáva inferenciu. Samotný prompt mu
  nesprístupňuje GitHub, Cloudflare, lokálny počítač ani nástroje.
- `triad_status` uvádza integráciu v kóde, ale živý stav Gemini sa potvrdí iba
  úspešným API volaním. Kvóty zostávajú spravované poskytovateľmi.

Google má osobitné Gemini API Managed Agents rozhranie, ktoré je v dokumentácii
označené ako preview. Takýto agent sa vytvára samostatným API zdrojom s vlastným
ID; to nie je automatická väzba na Gem UI ID. Trinity ho nevytvára ani nemení
nastavenia Google účtu.

## Zdroj

- [Gemini API `generateContent`](https://ai.google.dev/api/generate-content)
- [Google Gemini API: Managed Agents](https://ai.google.dev/gemini-api/docs/custom-agents)
