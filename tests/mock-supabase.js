(function(){
  const store=JSON.parse(localStorage.getItem("__mockdb")||'{"docs":[],"profiles":{},"users":{}}');
  const save=()=>localStorage.setItem("__mockdb",JSON.stringify(store));
  const CONFIRM=localStorage.getItem("__confirm")==="1";
  window.__mock={store,calls:[]};
  function createClient(){
    let session=JSON.parse(localStorage.getItem("__mocksess")||"null");const subs=[];
    const emit=(ev)=>subs.forEach(f=>f(ev,session));
    const login=(u)=>{session={user:{id:u.id,email:u.email,app_metadata:{provider:"email"},user_metadata:u.meta||{}}};localStorage.setItem("__mocksess",JSON.stringify(session));store.profiles[u.id]=store.profiles[u.id]||{plan:"free",plan_until:null};save();emit("SIGNED_IN")};
    const err=m=>({data:{},error:{message:m}});
    const auth={
      getSession:async()=>({data:{session}}),
      onAuthStateChange:(f)=>{subs.push(f);setTimeout(()=>f("INITIAL_SESSION",session),0);return{data:{subscription:{unsubscribe(){}}}}},
      signUp:async({email,password,options})=>{__mock.calls.push(["signUp",email]);if(store.users[email])return{data:{user:{identities:[]},session:null},error:null};
        const u={id:"u-"+email.replace(/\W/g,""),email,password,meta:(options&&options.data)||{},confirmed:!CONFIRM};store.users[email]=u;save();
        if(CONFIRM)return{data:{user:{identities:[{}]},session:null},error:null};login(u);return{data:{user:{identities:[{}]},session},error:null}},
      signInWithPassword:async({email,password})=>{const u=store.users[email];if(!u||u.password!==password)return err("Invalid login credentials");if(!u.confirmed)return err("Email not confirmed");login(u);return{data:{session},error:null}},
      signInWithOtp:async({email})=>{__mock.calls.push(["otp",email]);if(!store.users[email])return err("Signups not allowed for otp");return{data:{},error:null}},
      resend:async({type,email})=>{__mock.calls.push(["resend",type,email]);return{data:{},error:null}},
      resetPasswordForEmail:async(email)=>{__mock.calls.push(["reset",email]);return{data:{},error:null}},
      verifyOtp:async({email,token,type})=>{__mock.calls.push(["verify",type]);if(token!=="12345678")return err("Token has expired or is invalid");const u=store.users[email];if(!u)return err("Token has expired or is invalid");u.confirmed=true;save();login(u);if(type==="recovery")emit("PASSWORD_RECOVERY");return{data:{session},error:null}},
      updateUser:async({password})=>{const u=Object.values(store.users).find(x=>x.id===session.user.id);u.password=password;save();__mock.calls.push(["updateUser"]);return{data:{},error:null}},
      signInWithOAuth:async({provider})=>{__mock.calls.push(["oauth",provider]);return{error:null}},
      signOut:async()=>{session=null;localStorage.removeItem("__mocksess");emit("SIGNED_OUT");return{error:null}}
    };
    function from(table){
      const q={f:{},r:null};
      const run=()=>{if(table==="profiles"){return{data:store.profiles[q.f.id]||null,error:null}}
        let rows=store.docs.filter(d=>Object.entries(q.f).every(([k,v])=>d[k]===v));if(q.r)rows=rows.slice(q.r[0],q.r[1]+1);
        return{data:rows.map(d=>({collection:d.collection,id:d.id,data:JSON.parse(JSON.stringify(d.data))})),error:null}};
      const api={select(){return api},eq(k,v){q.f[k]=v;return api},range(a,b){q.r=[a,b];return api},maybeSingle(){return Promise.resolve(run())},
        then(res,rej){return Promise.resolve(run()).then(res,rej)},
        upsert(rows){(Array.isArray(rows)?rows:[rows]).forEach(r=>{const i=store.docs.findIndex(d=>d.user_id===r.user_id&&d.collection===r.collection&&d.id===r.id);i>=0?store.docs[i]=r:store.docs.push(r)});save();return Promise.resolve({error:null})},
        delete(){return{match(m){store.docs=store.docs.filter(d=>!Object.entries(m).every(([k,v])=>d[k]===v));save();return Promise.resolve({error:null})}}}};
      return api;
    }
    return{auth,from,rpc:async(n)=>{if(n==="delete_my_account"){const id=session.user.id;store.docs=store.docs.filter(d=>d.user_id!==id);delete store.profiles[id];for(const k in store.users)if(store.users[k].id===id)delete store.users[k];save()}return{error:null}},
      channel:()=>{const c={on(){return c},subscribe(cb){setTimeout(()=>cb&&cb("SUBSCRIBED"),10);return c}};return c},removeChannel(){}};
  }
  window.supabase={createClient};
})();
