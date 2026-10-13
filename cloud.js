(function(root){
'use strict';
const SESSION='kstar-cloud-session-v2';let session=null;
try{session=JSON.parse(sessionStorage.getItem(SESSION));}catch(e){}
const config=()=>{const c=root.KSTAR_CLOUD_CONFIG||{},u=new URL(c.url);if(u.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/.test(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!c.publishableKey)throw Error('免费数据库尚未配置');if(c.publishableKey.startsWith('sb_secret_'))throw Error('禁止使用私密服务密钥');return {...c,url:u.origin};};
async function request(path,body,token){const c=config(),res=await fetch(c.url+path,{method:'POST',cache:'no-store',headers:{apikey:c.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await res.json().catch(()=>null);if(!res.ok){if(res.status===409||data?.code==='40001')throw Error('云端版本已变化，未覆盖。请重新读取云端再选择。');if(res.status===401||res.status===403)throw Error('登录已失效或无权限，请重新登录');throw Error('云端请求未完成，请检查登录信息、网络和数据库配置');}return data;}
function store(s){session=s;sessionStorage.setItem(SESSION,JSON.stringify(s));}
async function token(){if(!session)throw Error('请先登录');if(session.expires_at*1000<Date.now()+30000){const next=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});store(next);}return session.access_token;}
root.KSTARCloud={
 configured(){try{config();return true;}catch(e){return false;}},
 signedIn(){return !!session;},
 async signIn(email,password){store(await request('/auth/v1/token?grant_type=password',{email,password}));},
 async signOut(){try{if(session)await request('/auth/v1/logout',{scope:'local'},await token());}finally{session=null;sessionStorage.removeItem(SESSION);}},
 async read(){return request('/rest/v1/rpc/kstar_get_snapshot',{},await token());},
 async upload(document,expected_revision){return request('/rest/v1/rpc/kstar_sync_snapshot',{document,expected_revision},await token());}
};
})(window);
