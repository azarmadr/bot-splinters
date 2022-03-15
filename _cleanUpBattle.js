/** Motive for the release tag 2.2:
 * Converting array of battles to objects of pattern {t1:{t2:result}} */
const {readFileSync,writeFileSync} = require('jsonfile');
const {_arr,_dbug,_team,log}=require('./util');
const fileName = './data/battle_data.json';
const nb = require(fileName);
const {merge} = require("./battles-data");
const R = require('ramda')

let ac={c:0,a:0,e:0,s:0};
const mm_=(rs,mana,crs)=>{
  let c={s:0,c:0};
  for(let s in crs)if(c.s++||1)for(let _ in crs[s])c.c++;
  if(_dbug.tt.n?.at(-1)?.rs!==rs.toString())delete _dbug.tt.n
  _dbug.tt.n = {...c,rs:rs+'',mana};
  Object.keys(c).forEach(k=>ac[k]+=c[k])
}
const mm=(rs,mana,crs)=>{
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
log({...ac,e:_arr.rmEmpty(nb)})
// if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
if(ac.a||ac.e||ac.s){
  const {Standard,...rem} = nb;
  writeFileSync(fileName.replace(/.json/,'-t.json'),{Standard,...rem})
  log('done')
}else log(fileName,'is intact')
