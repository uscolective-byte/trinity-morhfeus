const numeric=value=>typeof value==='number'&&Number.isFinite(value);

export function formatWeather(outcome={}) {
  if(outcome.available!==true)return outcome.reason||'Nepodarilo sa načítať počasie.';
  const current=outcome.current||{};
  const readings=[
    numeric(current.temperature_c)?`${current.temperature_c}°C`:null,
    numeric(current.humidity_pct)?`vlhkosť ${current.humidity_pct}%`:null,
    numeric(current.wind_speed_kmh)?`vietor ${current.wind_speed_kmh} km/h`:null
  ].filter(Boolean);
  if(!readings.length)return 'Počasie neobsahuje overiteľné aktuálne merania.';
  const place=[outcome.location?.name,outcome.location?.country].filter(Boolean).join(', ');
  return `Počasie${place?` (${place})`:''}: ${readings.join(', ')}.`+
    (outcome.source?`\nZdroj: ${outcome.source}.`:'');
}

export function formatCryptoPrices(outcome={}) {
  if(outcome.available!==true)return outcome.reason||'Nepodarilo sa načítať ceny kryptomien.';
  const coins=(Array.isArray(outcome.coins)?outcome.coins:[]).filter(coin=>numeric(coin?.price_usd));
  if(!coins.length)return 'Pre požadované kryptomeny nie sú dostupné overiteľné ceny.';
  return 'Ceny kryptomien v USD:\n'+coins.map(coin=>
    `- ${coin.symbol||coin.id}: ${coin.price_usd} USD${coin.timestamp?` (čas údaja: ${coin.timestamp})`:''}`
  ).join('\n')+(outcome.source?`\nZdroj: ${outcome.source}.`:'');
}

export function formatTechNews(outcome={}) {
  if(outcome.available!==true)return outcome.reason||'Nepodarilo sa načítať technologické správy.';
  const stories=(Array.isArray(outcome.stories)?outcome.stories:[]).filter(story=>typeof story?.title==='string'&&story.title.trim());
  if(!stories.length)return 'Zdroj nevrátil žiadne dostupné technologické správy.';
  return 'Technologické správy zo zdroja Hacker News:\n'+stories.map(story=>{
    const title=story.url?`[${story.title}](${story.url})`:story.title;
    const metrics=[numeric(story.score)?`${story.score} bodov`:null,numeric(story.comments_count)?`${story.comments_count} komentárov`:null].filter(Boolean);
    return `- ${title}${metrics.length?` (${metrics.join(' · ')})`:''}`;
  }).join('\n');
}
