/** Motive for the release tag 2.2:
 * Converting array of battles to objects of pattern {t1:{t2:result}} */
const {readFileSync,writeFileSync} = require('jsonfile');
const {_arr,log}=require('./util');
const fileName = './data/battle_data.json';
const old_battles = require(fileName);
var nb;
try {
  // temporary file to store battle_data while cleaning or merging multiple older battle_data
  nb = readFileSync('./data/battle_data-temp.json')
}catch(e){
  log(e)
  nb = {}
}
const nBattles = (obj, obj2merge) => {
  for (let [s, v] of Object.entries(obj2merge)) {
    if(s.includes(',')){for(let[t,r]of Object.entries(v)){
      console.count();require('readline').moveCursor(process.stdout,0,-1);
      if(r=='l')     (obj[t]??={})[s]=2;
      else if(r=='w')(obj[s]??={})[t]=2;
      else{
        (obj[t]??={})[s]??=1;
        (obj[s]??={})[t]??=1;
      }
    }} else nBattles(obj[s] ??= {}, v);
  }
};
nBattles(nb, old_battles);
log()
// if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
writeFileSync(fileName.replace(/.json/,'-temp.json'),nb)
log('done')
