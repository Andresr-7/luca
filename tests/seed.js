// Datos de prueba inventados
module.exports=function seed(){
  const uidU="u-test";const D=[];const add=(c,id,data)=>D.push({user_id:uidU,collection:c,id,data});
  add("ajustes","principal",{montoPago:1450000,diasPago:[15,30],otros:null,trm:3156,trmFecha:"2026-10-20",onboarded:true,nombre:"Andrés",
    fijos:[{nombre:"Plan celular",valor:55000,dia:22,pagado:null},{nombre:"Spotify",valor:16900,dia:21,pagado:null}],
    categorias:["Comida","Transporte","Salidas","Ropa","Hogar","Suscripciones","Juegos","Salud","Otros"],presupuestos:{Comida:400000}});
  add("tarjetas","t1",{nombre:"Nubank",saldo:1200000,minimo:245000,dia:21,corte:12,cupo:3000000,orden:0});
  add("tarjetas","t2",{nombre:"Bancolombia American Express Gold",saldo:800000,minimo:90000,usd:true,saldoUsd:120.5,minimoUsd:25,dia:25,orden:1,interes:1.9});
  add("tarjetas","t3",{nombre:"Serfinanza",saldo:300000,minimo:null,dia:5,orden:2});
  add("cuentas","c1",{nombre:"Nequi",saldo:380000,orden:0});
  add("cuentas","c2",{nombre:"Ahorros Bancolombia",saldo:900000,orden:1});
  const g=[["2026-10-02",18000,"Comida","Almuerzo","c1"],["2026-10-06",18000,"Comida","Almuerzo","c1"],["2026-10-09",18000,"Comida","Almuerzo","c1"],
    ["2026-10-03",12500,"Transporte","Uber","t1"],["2026-10-11",160000,"Salidas","Concierto","t1"],["2026-10-11",45000,"Salidas","Cervezas","c1"],
    ["2026-10-14",89000,"Ropa","Tenis","t2"],["2026-10-16",3200,"Transporte","Transmilenio","c1"],["2026-10-17",3200,"Transporte","Transmilenio","c1"],
    ["2026-10-18",62000,"Comida","Mercado","c2"],["2026-10-19",25000,"Juegos","Robux","t1"],["2026-09-20",30000,"Comida","Almuerzo","c1"],["2026-09-25",120000,"Hogar","Servicios","c2"]];
  g.forEach(([f,v,c,n,m],i)=>add("gastos","g"+i,{valor:v,categoria:c,nota:n,fecha:f,medio:m.startsWith("c")?(m==="c1"?"Nequi":"Ahorros Bancolombia"):({t1:"Nubank",t2:"Bancolombia American Express Gold"})[m],
    cuentaId:m.startsWith("c")?m:null,tarjetaId:m.startsWith("t")?m:null,creado:Date.parse(f)+i}));
  add("pagos","p1",{tarjeta:"Nubank",tarjetaId:"t1",valor:300000,fecha:"2026-10-01",cuentaId:"c2"});
  add("ingresos","i1",{valor:1450000,fecha:"2026-10-15",nota:"Quincena",cuentaId:"c1",cuenta:"Nequi"});
  add("metas","m1",{nombre:"Viaje a Cartagena",objetivo:2000000,ahorrado:840000});
  add("metas","m2",{nombre:"Audífonos",objetivo:300000,ahorrado:250000});
  return {store:{docs:D,profiles:{[uidU]:{plan:"free",plan_until:null}},users:{"prueba@ejemplo.com":{id:uidU,email:"prueba@ejemplo.com",password:"ClaveSegura1!",meta:{nombre:"Andrés"},confirmed:true}}},
    sess:{user:{id:uidU,email:"prueba@ejemplo.com",app_metadata:{provider:"email"},user_metadata:{nombre:"Andrés"}}}};
};
