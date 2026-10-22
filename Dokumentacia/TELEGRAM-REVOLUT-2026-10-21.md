# Telegram a príjmy Trinity

## Čo je implementované v tejto vetve
- Telegram webhook s oddeleným tajomstvom, numerickým ID vlastníka a súkromným chatom. Telefónne číslo nie je identita bota ani API poverenie.
- Nový Cloudflare Workflow TrinityTelegram, oddelený pre development a produkciu, trvalé ID podľa update_id a uložená odpoveď pred odoslaním. História posledných šiestich výmen v D1. Súbežné správy môžu načítať rovnakú históriu; nie je to serializovaná fronta.
- Overenie getMe, setWebhook a getWebhookInfo cez owner UI. Toto nie je dôkaz skutočného doručenia odpovede.
- Telegram admin nástroje sú predvolene vypnuté. Až po overení identity môže vlastník výslovne nastaviť TELEGRAM_ADMIN_ENABLED=true. Finančné operácie so skutočnými peniazmi nie sú implementované.
- Ponuky s pevnou sumou v centoch a platobným odkazom z Revolut Pro; evidencia potenciálnych zákazníkov s uvedeným zdrojom. Návrh neznamená odoslanie, uzatvorený obchod ani úhradu.
- GET /api/assistant/commerce, POST /api/assistant/commerce/offers a /leads sú owner-only. User a admin nevidia owner finančné panely.
- Existujúce portfólio a wallet zostávajú simuláciou. Revtag isabo je údaj používateľa, nie potvrdené prepojenie bankového účtu.

## Aktivácia Telegramu
1. V @BotFather vytvoriť bota cez /newbot.
2. Nastaviť Worker Secrets TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (32–256 znakov A-Z, a-z, 0-9, _ alebo -) a TELEGRAM_OWNER_USER_ID (číselné používateľské ID).
3. Zo zložky Trinity možno použiť bash scripts/configure-telegram.sh development alebo production. Token sa zadáva do Wrangler promptu, nikdy do argumentov alebo repozitára.
4. Po nasadení otvor Nastavenia -> Telegram -> Overiť bota a zapnúť webhook.
5. Poslať botovi súkromnú správu. Až prijatá odpoveď a audit telegram_reply_sent potvrdzujú celú cestu.
6. Tajomstvá sa medzi development a production nededia; každý bot má iba jeden webhook. Použiť samostatného bota pre každé prostredie alebo aktivovať iba jedno.

## Revolut Pro
Platobný odkaz sa vytvorí v aplikácii Revolut Pro a vloží do ponuky v Trinity. Odkaz @isabo sám neposkytuje API prístup k zostatku, transakciám ani obchodovaniu. Úhrada musí zostať neoverená, kým neexistuje potvrdenie poskytovateľa alebo osobitný dôveryhodný import. Kód neprihlasuje používateľa do banky, neotvára právny bankový účet pre AI a nevytvára reálne nákupné pokyny.

## Obchodný postup
Použiť existujúce prospect_queries + web_search/web_fetch na konkrétny segment. Uložiť iba verejné firemné informácie a ich zdroj do /commerce/leads. Vytvoriť ponuku na dodateľnú službu (napríklad web alebo automatizáciu), určiť rozsah, cenu a platobný odkaz. Oslovenie zákazníka vyžaduje konkrétne zadanie; táto implementácia nemá automatické rozosielanie.

## Overenie
Pridané testy identity, tajomstva, deduplikácie workflow, webhook receipt, úniku bot tokenu a platobných odkazov. Plný Node/Worker build, UI smoke a živé prepojenie treba potvrdiť samostatne. Predchádzajúce CI skončilo bez spustených krokov; blokér sa týmto kódom neobchádza.

Zdroje:
- https://core.telegram.org/bots/api
- https://help.revolut.com/en-SK/help/more/revolut-pro/accepting-customer-payments/
