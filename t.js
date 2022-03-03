const {log,_dbug,} = require('./util');
const args = require("minimist")(process.argv.slice(2));
const {readFileSync,writeFileSync} = require('jsonfile');

const drs = args.drs ?? "";
const player = args.n ?? "";
const depth = args.d ?? 2;
const fn = args.f ?? "";
const {fromUsers,merge,save} = require("./battles-data");
const minRank = args.mr ?? 0;

//log({drs,player,depth,fn,minRank,args});

const mergeNempty =bd=>o=>{
  const ob = require(o),count = [];
  Object.entries(ob).forEach(([rs,rs_])=>Object.entries(rs_).forEach(([rs1,crs])=>{
    const obj = (bd[rs]??={})[rs1];
    if(rs1.match(/\d+/)){
      const mana = rs1;
      const {c} = merge(obj,crs)
      if(c)
        count.push({rs,mana,c});
      ob[rs][rs1] = {};
    }else{
      Object.entries(crs).forEach(([mana,crs1])=>{
        const obj1 =obj[mana]??={};
        const {c} = merge(obj1,crs1)
        if(c)
          count.push({rs,rs1,mana,c});
        ob[rs][rs1][mana] = {};
      })
    }
  }))
  if(count.length){
    const {__,...res} = count.reduce((a,{rs,rs1,mana,c})=>{
      let x = rs+(rs1?'_|_'+rs1:'');
      if(a[x]){a[x].c+=c,a[x][mana]=c}
      else {a[x]={c,[mana]:c}}
      a.__.c+=c;a.__[mana]??=0;a.__[mana]+=c;
      return a
    },{__:{c:0}})
    console.table({...res,__});
    writeFileSync(o,ob);
    writeFileSync(`./data/battle_data${fn}.json`, bd);
  }
}

if ("b" in args){
  log({drs,player,depth,fn,minRank});
  Promise.resolve(fromUsers(player, { depth, drs, fn, minRank })).then(
    () => {}
  );
}else if ("m" in args) {
  const bd = readFileSync(`./data/battle_data${fn}.json`);
  args.m
    .split(",")
    .map(x => log(x) ?? x)
    .forEach(mergeNempty(bd));
} else log({m:'merge',b:'battles'});
