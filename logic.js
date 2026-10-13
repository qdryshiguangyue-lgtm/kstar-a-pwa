(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KSTARLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const M=10000,round=x=>Math.round((x+Number.EPSILON)*100)/100;
const finite=(x,min=0)=>typeof x==='number'&&Number.isFinite(x)&&x>=min;
const quantity=p=>p.lots*(p.multiplier??M);
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
function perShare(value,unit,multiplier=M){if(!finite(value)||!Number.isSafeInteger(multiplier)||multiplier<1)throw Error('权利金或合约单位无效');if(!['share','contract'].includes(unit))throw Error('请选择权利金单位');return unit==='contract'?value/multiplier:value;}
function validate(s){
 if(!s||s.account!=='A'||!finite(s.capital)||s.capital<=0||!finite(s.price))throw Error('A账户本金或ETF价格无效');
 for(const k of ['baseShares','freeShares','totalShares'])if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error('ETF份额必须为非负整数');
 if(s.baseShares+s.freeShares!==s.totalShares)throw Error('本金仓与自由仓数量不一致');
 if(!Array.isArray(s.puts)||!Array.isArray(s.calls))throw Error('期权持仓格式错误');
 for(const p of [...s.puts,...s.calls]){
  if(!p||!finite(p.strike)||p.strike<=0||!Number.isSafeInteger(p.lots)||p.lots<=0||!finite(p.open)||!Number.isSafeInteger(p.multiplier??M)||(p.multiplier??M)<=0||!Number.isSafeInteger(quantity(p)))throw Error('期权执行价、手数、权利金或合约单位无效');
  if(p.current!=null&&!finite(p.current))throw Error('当前权利金无效');
  if(p.expiry&&!validDate(p.expiry))throw Error('期权到期日无效');
 }
 if(s.calls.reduce((a,p)=>a+quantity(p),0)>s.totalShares)throw Error('CALL合计超过ETF持仓，不能形成裸卖CALL');
 for(const k of ['cash','netFunding','scenarioFees'])if(s[k]!=null&&!finite(s[k],k==='cash'||k==='netFunding'?-Number.MAX_VALUE:0))throw Error('现金、累计净投入或情景费用无效');
}
function summary(s){validate(s);const puts=s.puts,all=[...puts,...s.calls],cash=puts.reduce((a,p)=>a+p.strike*quantity(p),0),gross=all.reduce((a,p)=>a+p.open*quantity(p),0),known=all.every(p=>finite(p.current)),mark=known?all.reduce((a,p)=>a+p.current*quantity(p),0):null;return {lots:puts.reduce((a,p)=>a+p.lots,0),callLots:s.calls.reduce((a,p)=>a+p.lots,0),assignmentShares:puts.reduce((a,p)=>a+quantity(p),0),assignmentCash:round(cash),grossPremium:round(gross),markCost:mark==null?null:round(mark),unrealized:mark==null?null:round(gross-mark),sharesAfter:s.totalShares+puts.reduce((a,p)=>a+quantity(p),0),etfValue:round(s.totalShares*s.price),currentEquity:s.cash!=null&&mark!=null?round(s.cash+s.totalShares*s.price-mark):null};}
function expiry(s,price){
 validate(s);if(!finite(price))throw Error('情景价格必须为非负数');
 const assigned=s.puts.filter(p=>price<p.strike),exercised=s.calls.filter(p=>price>p.strike),shares=assigned.reduce((a,p)=>a+quantity(p),0),cash=assigned.reduce((a,p)=>a+p.strike*quantity(p),0),sold=exercised.reduce((a,p)=>a+quantity(p),0),saleCash=exercised.reduce((a,p)=>a+p.strike*quantity(p),0);
 const putPnl=s.puts.reduce((a,p)=>a+(p.open-Math.max(p.strike-price,0))*quantity(p),0),callPnl=s.calls.reduce((a,p)=>a+(p.open-Math.max(price-p.strike,0))*quantity(p),0),after=s.totalShares+shares-sold,fees=s.scenarioFees??null,remainingCash=s.cash!=null?round(s.cash-cash+saleCash):null,equity=remainingCash!=null&&fees!=null?round(remainingCash+after*price-fees):null,pnl=equity!=null&&s.netFunding!=null?round(equity-s.netFunding):null;
 const dates=new Set([...s.puts,...s.calls].map(p=>p.expiry||'未记录'));
 return {price,assignedShares:shares,assignmentCash:round(cash),callSoldShares:sold,callSaleCash:round(saleCash),putPnl:round(putPnl),callPnl:round(callPnl),grossPremium:summary(s).grossPremium,sharesAfter:after,etfMarketValue:round(after*price),remainingCash,equity,pnl,lossRate:pnl==null?null:Math.max(0,-pnl)/s.capital,deliveryCashShortfall:remainingCash==null?null:Math.max(0,-remainingCash),putCashShortfall:s.cash==null?null:Math.max(0,round(cash-s.cash)),mixedExpiry:dates.size>1||dates.has('未记录')};
}
function candidate(s,c){validate(s);if(c.kind==='wait')return {kind:'wait',title:'等待',note:'不增加新的期权义务',netPremium:0};const {strike,lots,premium,fees=0,multiplier=M}=c;if(!finite(strike)||strike<=0||!Number.isSafeInteger(lots)||lots<1||!finite(premium)||!finite(fees)||!Number.isSafeInteger(multiplier)||multiplier<1||!Number.isSafeInteger(lots*multiplier))throw Error('请检查执行价、手数、权利金和费用');const q=lots*multiplier,net=round(q*premium-fees);if(c.kind==='put')return {kind:'put',netPremium:net,assignmentCash:round(q*strike),assignmentShares:q,breakeven:Number((strike-net/q).toFixed(6)),totalPutCash:round(summary(s).assignmentCash+q*strike),risk:'新增接货资金不等于保证金；未评估到期前保证金变化，不能保证不会被强平'};if(c.kind==='call'){const reserved=c.reserved??0;if(!Number.isSafeInteger(reserved)||reserved<0||reserved>s.totalShares)throw Error('预留份额无效');if(q>s.totalShares-reserved)throw Error('超过可备兑份额，禁止裸卖CALL');return {kind:'call',netPremium:net,coveredShares:q,uncommittedShares:s.totalShares-reserved-q,saleCash:round(q*strike),risk:'备兑CALL仍承担ETF下跌风险，且限制上涨收益；本结果不等于券商保证金评估'};}throw Error('未知交易类型');}
function ledger(s,events){validate(s);if(!Array.isArray(events))throw Error('流水格式错误');let pnl=0,buy=0,sell=0,cost=0;const ids=new Set();for(const e of events){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id))throw Error('流水编号缺失或重复');ids.add(e.id);if(!validDate(e.date))throw Error('流水日期无效');if(e.type==='option'){if(!finite(e.amount,-Number.MAX_VALUE))throw Error('损益无效');pnl+=e.amount;}else if(e.type==='buy'||e.type==='sell'){if(!Number.isSafeInteger(e.shares)||e.shares<=0||!finite(e.cash))throw Error('自由仓流水无效');if(e.type==='buy'){buy+=e.shares;cost+=e.cash;}else sell+=e.shares;}else throw Error('未知流水类型');}return {recordedOptionPnl:round(pnl),freeSharesFromLedger:buy-sell,snapshotFreeShares:s.freeShares,matched:buy-sell===s.freeShares,recordedFreeBuyCost:round(cost)};}
return {M,round,quantity,validDate,perShare,validate,summary,expiry,candidate,ledger};});
