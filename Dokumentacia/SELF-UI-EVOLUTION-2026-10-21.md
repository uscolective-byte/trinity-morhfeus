# Vývoj vlastného UI Trinity
V overenej admin relácii stačí bežná požiadavka, napríklad „Zväčši text a zlepši mobilné rozloženie“. Agent má použiť project_inspect s scope:ui a improvement_submit s kind:code_improvement, scope:ui, execute:true. Nástroj vytvorí auditovaný návrh, vykoná autorizovanú prípravu kódu a vráti skutočnú vetvu a PR.

V nastaveniach samorozvoja je rozsah „Vlastné UI“. Formulár vytvorí návrh; existujúce ovládanie schválenia a aplikácie spustí prípravu PR. Nepredstiera okamžitú zmenu živého rozhrania.

UI režim číta z konkrétneho commitu iba chat.html, chat.css a theme.css. Nezasahuje do API, autentifikácie ani nasadzovania. Presné náhrady musia mať jednoznačný pôvodný úsek. Existujúce HTML ID musia zostať zachované a nové nesmú byť duplicitné. Táto kontrola nenahrádza kontrolu HTML parserom, funkčný test ani vizuálne overenie.

Rozsah sa ukladá ako prefix [TRINITY_SCOPE:UI] v opise existujúceho návrhu. Netreba novú D1 migráciu. Staršie návrhy zostávajú v režime code.

Potrebné: Worker Secret TRINITY_GITHUB_TOKEN (Contents a Pull requests Read/Write pre repozitár), Workers AI a funkčný GitHub Actions runner. Tajomstvá sa nikdy neukladajú do zdrojových súborov. Automatická integrácia UI naďalej vyžaduje zapnuté TRINITY_AUTO_MERGE, zelené kontroly presného commitu a GitHub pravidlá.

Výsledok PR obsahuje scope, tests:pending, visual_verification:pending a deployed:false. Zlúčenie nie je dôkaz nasadenia. Produkciu over až podľa úspešného deployu a kontroly verzie. Pri chybe vráť konkrétnu prekážku a URL kontroly.

Overenie pri príprave: syntaktické kontroly upravených modulov a izolované kontroly hraníc UI. Node integračné testy sú doplnené, ale neboli spustené: pracovné prostredie je offline. Živá modelová úprava, browser test a nasadenie nie sú overené.
