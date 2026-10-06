import {z} from 'zod';
import {HttpError} from './security.js';

const currency=z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const symbol=z.string().trim().toUpperCase().min(1).max(24).regex(/^[A-Z0-9._:/-]+$/);
const isoDate=z.string().datetime({offset:true});
const money=z.number().finite().min(0).max(100000000);
const quantity=z.number().finite().positive().max(100000000);
const toCents=value=>Math.round(value*100);
const toMicros=value=>Math.round(value*1000000);
const fromCents=value=>Number((value/100).toFixed(2));
const fromMicros=value=>Number((value/1000000).toFixed(6));

export const portfolioSchema=z.object({name:z.string().trim().min(2).max(100),base_currency:currency.default('EUR'),starting_cash:money.default(10000),max_position_pct:z.number().int().min(1).max(100).default(20),max_drawdown_pct:z.number().int().min(1).max(100).default(15)}).strict();
export const tradeSchema=z.object({symbol,asset_type:z.enum(['stock','etf','crypto','bond','commodity','forex','other']),side:z.enum(['buy','sell']),quantity,price:money,fee:money.default(0),executed_at:isoDate.default(()=>new Date().toISOString()),thesis:z.string().trim().max(2000).default(''),source:z.string().trim().max(100).default('manual')}).strict();
export const quoteSchema=z.object({symbol,currency,price:money,as_of:isoDate.default(()=>new Date().toISOString()),source:z.string().trim().max(100).default('manual')}).strict();
export const TRADING_DIRECTIVE=`FINANCIE A OBCHODOVANIE: Pri investičných témach konaj ako opatrný analytik, nie ako garant zisku. Rozlišuj fakty, odhady a scenáre; pri aktuálnych cenách vždy vyžaduj čerstvý zdroj. Posudzuj diverzifikáciu, likviditu, poplatky, časový horizont, maximálnu stratu a koncentráciu. Nikdy netvrď, že papierový obchod je reálny obchod. Trinity nemá oprávnenie autonómne obchodovať s reálnymi peniazmi a nesmie obchádzať potvrdenie používateľa.`;

function presentPortfolio(row){const {starting_cash_cents,...rest}=row;return {...rest,starting_cash:fromCents(starting_cash_cents),paper_only:true};}
export async function createPortfolio(env,ownerId,input){const d=portfolioSchema.parse(input),id=crypto.randomUUID();const row=await env.DB.prepare(`INSERT INTO trading_portfolios(id,owner_id,name,base_currency,starting_cash_cents,max_position_pct,max_drawdown_pct) VALUES(?,?,?,?,?,?,?) RETURNING *`).bind(id,ownerId,d.name,d.base_currency,toCents(d.starting_cash),d.max_position_pct,d.max_drawdown_pct).first();return presentPortfolio(row);}
export async function listPortfolios(env,ownerId){const rows=await env.DB.prepare('SELECT * FROM trading_portfolios WHERE owner_id=? ORDER BY updated_at DESC LIMIT 50').bind(ownerId).all();return rows.results.map(presentPortfolio);}

export function computePortfolioSummary(portfolio,transactions,quotes=[]){
  let cash=portfolio.starting_cash_cents,realized=0,fees=0;
  const positions=new Map(),latest=new Map(quotes.map(q=>[`${q.symbol}:${q.currency}`,q]));
  for(const t of transactions){
    const position=positions.get(t.symbol)||{symbol:t.symbol,asset_type:t.asset_type,quantity_micros:0,cost_cents:0,last_trade_cents:0};
    const notional=Math.round(t.quantity_micros*t.price_cents/1000000);fees+=t.fee_cents;position.last_trade_cents=t.price_cents;
    if(t.side==='buy'){cash-=notional+t.fee_cents;position.quantity_micros+=t.quantity_micros;position.cost_cents+=notional+t.fee_cents;}
    else{if(t.quantity_micros>position.quantity_micros)throw new HttpError(409,`Predaj ${t.symbol} presahuje papierovú pozíciu.`);const allocated=position.quantity_micros?Math.round(position.cost_cents*t.quantity_micros/position.quantity_micros):0;cash+=notional-t.fee_cents;realized+=notional-t.fee_cents-allocated;position.quantity_micros-=t.quantity_micros;position.cost_cents-=allocated;}
    positions.set(t.symbol,position);
  }
  let marketValue=0,unrealized=0;
  const items=[...positions.values()].filter(p=>p.quantity_micros>0).map(p=>{const quote=latest.get(`${p.symbol}:${portfolio.base_currency}`),price=quote?.price_cents??p.last_trade_cents;const value=Math.round(p.quantity_micros*price/1000000);marketValue+=value;unrealized+=value-p.cost_cents;return {symbol:p.symbol,asset_type:p.asset_type,quantity:fromMicros(p.quantity_micros),average_cost:fromCents(Math.round(p.cost_cents*1000000/p.quantity_micros)),last_price:fromCents(price),market_value:fromCents(value),unrealized_pnl:fromCents(value-p.cost_cents),quote_as_of:quote?.as_of||null,quote_source:quote?.source||'last-paper-trade'};});
  const equity=cash+marketValue;
  return {paper_only:true,currency:portfolio.base_currency,cash:fromCents(cash),market_value:fromCents(marketValue),equity:fromCents(equity),realized_pnl:fromCents(realized),unrealized_pnl:fromCents(unrealized),fees:fromCents(fees),positions:items};
}

export async function getPortfolio(env,ownerId,id){const portfolio=await env.DB.prepare('SELECT * FROM trading_portfolios WHERE id=? AND owner_id=?').bind(id,ownerId).first();if(!portfolio)throw new HttpError(404,'Papierové portfólio neexistuje.');const [transactions,quotes]=await Promise.all([env.DB.prepare('SELECT * FROM trading_transactions WHERE portfolio_id=? AND owner_id=? ORDER BY executed_at,id').bind(id,ownerId).all(),env.DB.prepare('SELECT * FROM trading_quotes WHERE owner_id=? AND currency=?').bind(ownerId,portfolio.base_currency).all()]);return {portfolio:presentPortfolio(portfolio),summary:computePortfolioSummary(portfolio,transactions.results,quotes.results),transactions:transactions.results.map(t=>{const {quantity_micros,price_cents,fee_cents,...rest}=t;return {...rest,quantity:fromMicros(quantity_micros),price:fromCents(price_cents),fee:fromCents(fee_cents)};})};}
export async function recordTrade(env,ownerId,portfolioId,input){const d=tradeSchema.parse(input),portfolio=await env.DB.prepare('SELECT id FROM trading_portfolios WHERE id=? AND owner_id=?').bind(portfolioId,ownerId).first();if(!portfolio)throw new HttpError(404,'Papierové portfólio neexistuje.');const q=toMicros(d.quantity);if(d.side==='sell'){const held=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN side='buy' THEN quantity_micros ELSE -quantity_micros END),0) AS quantity FROM trading_transactions WHERE portfolio_id=? AND owner_id=? AND symbol=?`).bind(portfolioId,ownerId,d.symbol).first();if(q>Number(held.quantity||0))throw new HttpError(409,'Predaj presahuje množstvo v papierovom portfóliu.');}const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO trading_transactions(id,portfolio_id,owner_id,symbol,asset_type,side,quantity_micros,price_cents,fee_cents,executed_at,thesis,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,portfolioId,ownerId,d.symbol,d.asset_type,d.side,q,toCents(d.price),toCents(d.fee),d.executed_at,d.thesis,d.source).run();await env.DB.prepare("UPDATE trading_portfolios SET updated_at=datetime('now') WHERE id=?").bind(portfolioId).run();return getPortfolio(env,ownerId,portfolioId);}
export async function setQuote(env,ownerId,input){const d=quoteSchema.parse(input);await env.DB.prepare(`INSERT INTO trading_quotes(owner_id,symbol,currency,price_cents,as_of,source) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,symbol,currency) DO UPDATE SET price_cents=excluded.price_cents,as_of=excluded.as_of,source=excluded.source,updated_at=datetime('now')`).bind(ownerId,d.symbol,d.currency,toCents(d.price),d.as_of,d.source).run();return {...d,paper_only:true};}
