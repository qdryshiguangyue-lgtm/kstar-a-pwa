(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./logic.js'):root.KSTARLogic);if(typeof module==='object'&&module.exports)module.exports=api;root.KSTARData=api;})(typeof globalThis!=='undefined'?globalThis:this,function(L){
'use strict';
const KEY='kstar-a-pwa-v1',BACKUP=KEY+'-before-v2';
function migrate(input){
 if(!input||typeof input!=='object'||!input.snapshot||!Array.isArray(input.events))throw Error('需要含 snapshot 和 events 的KSTAR账户备份');
 if(input.schemaVersion!=null&&(!Number.isInteger(input.schemaVersion)||input.schemaVersion>2||input.schemaVersion<1))throw Error('不支持该备份版本');
 const d=JSON.parse(JSON.stringify(input));d.snapshot.calls??=[];
 for(const p of [...(d.snapshot.puts||[]),...d.snapshot.calls]){if(p.premiumUnit!=null&&p.premiumUnit!=='share')throw Error('备份权利金必须规范为元/份，请勿直接修改单位标记');p.multiplier??=L.M;p.premiumUnit='share';}
 d.schemaVersion=2;delete d.exportedAt;return d;
}
function validated(input){const d=migrate(input);L.validate(d.snapshot);L.ledger(d.snapshot,d.events);return d;}
function persist(storage,db){const raw=storage.getItem(KEY);if(raw!=null&&!storage.getItem(BACKUP))storage.setItem(BACKUP,raw);const next=validated(db);next.updatedAt=new Date().toISOString();storage.setItem(KEY,JSON.stringify(next));return next;}
function replace(storage,db){const next=validated(db),raw=storage.getItem(KEY);if(raw!=null)storage.setItem(KEY+'-before-replace',raw);return persist(storage,next);}
function exportJSON(db){return JSON.stringify({...db,schemaVersion:2,exportedAt:new Date().toISOString()},null,2);}
function csvCell(v){let s=v==null?'':String(v);if(/^[\s]*[=+\-@]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCSV(db){const d=validated(db),s=d.snapshot,rows=[['记录类型','字段/期权类型','值/执行价','手数','每张份数','开仓元/份','开仓元/张','当前元/份','到期日/日期','份额','金额元','备注']];
 for(const k of ['capital','baseShares','freeShares','totalShares','price','cash','netFunding','scenarioFees','asof'])rows.push(['账户',k,s[k]??'',...Array(8).fill(''),'']);
 for(const kind of ['puts','calls'])for(const p of s[kind])rows.push(['持仓',kind==='puts'?'PUT':'CALL',p.strike,p.lots,p.multiplier,p.open,p.open*p.multiplier,p.current??'',p.expiry??'','','',p.note??'']);
 for(const e of d.events)rows.push(['流水',e.type,'','','','','','',e.date,e.shares??'',e.amount??e.cash??'',e.note??'']);
 return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
return {KEY,BACKUP,migrate,validated,persist,replace,exportJSON,exportCSV};});
