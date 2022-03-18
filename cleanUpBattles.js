/** Motive for the release tag 2.2:
 * Converting array of battles to objects of pattern {t1:{t2:result}} */
const {readFileSync,writeFileSync} = require('jsonfile');
const {_arr,_dbug,_team,_card,log}=require('./util');
const fileName = './data/battle_data_rb.json';
const nb = require(fileName);
const {merge} = require("./battles-data");
const R = require('ramda')
const card_aliases = require('./data/card_aliases.json')
log(card_aliases)
let ac=new Proxy({},{get:(o,k)=>o[k]??=0});
const mm=()=>{};
const mm_=(rs,mana,crs)=>{
  let c=new Proxy({},{get:(o,k)=>o[k]??=0});
  const ca = card_aliases[
    rs.join().match(/Standard|Armored Up|Earthquake|Reverse Speed|Silenced Summoners/)?'Standard':
    rs.join().match(/Back to Basics/)?'Back to Basics':null
  ];
  if(ca){
    for(let s in crs)for(let t in crs[s])if([s,t].some(x=>_team(x).some(([c,l])=>c in ca &&
      Object.keys(ca[c]).find(x=>_card.color(x)==_card.color(c) && l<= ca[c][x])
    ))){
      const [sn,tn] = [s,t].map(_team).map(x=>x.map(([i,l])=>[(i in ca&&++c[i]) ?
        Object.keys(ca[i]).find(x=>_card.color(x)==_card.color(i) && l<= ca[i][x]):i,l]))
        .map(x=>''+x);
      _dbug.$1s.a = {sn,tn,s,t};
      c.s+=merge(crs,{[sn]:{[tn]:crs[s][t]}}).c
      c.c+=delete crs[s][t]
    }
  }
  if(_dbug.tt.n?.at(-1)?.rs!==rs.toString())delete _dbug.tt.n
  if(c.c)_dbug.tt.n = {rs:rs+'',mana,...c};
  Object.keys(c).forEach(k=>ac[k]+=c[k])
}
const _RefractorBattlesToMana=(rs,mana,crs)=>{
  let c={c:0,a:0,e:0};
  for(let s in crs){
    if(_team(s).length==1)(delete crs[s],c.a++);
    else for(let t in crs[s]){
      let nmana = Math.max(_team.mana(s),_team.mana(t),12);
      if(nmana!=mana){
        c.a++;
        c.c+=merge(rs.reduce((a,rule)=>a[rule],nb)[nmana]??={},{[s]:{[t]:crs[s][t]}}).c;
        delete crs[s][t];
      }
    }
    if(R.isEmpty(crs[s]))(delete crs[s],c.e++);
  }
  if(_dbug.tt.n?.at(-1)?.rs!==rs.toString())(delete _dbug.tt.n,log(rs+'',mana))
  if(c.a)_dbug.tt.n = {...c,rs:rs+'',mana};
  Object.keys(c).forEach(k=>ac[k]+=c[k])
}

Object.entries(nb).forEach(([rs,rs_])=>Object.entries(rs_).forEach(([rs1,crs])=>
  rs1.match(/\d+/)?mm([rs],rs1,crs):
  Object.entries(crs).forEach(([mana,crs])=>mm([rs,rs1],mana,crs))
))
delete _dbug.tt.n;
if(0)log(ac);else{
  ac.e = _arr.rmEmpty(nb)
  log(ac)
  // if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
  if(Object.values(ac).some(x=>x)){
    const {Standard,...rem} = nb;
    writeFileSync(fileName.replace(/.json/,'-t.json'),{Standard,...rem})
    log('done')
  }else log(fileName,'is intact')
}
