/** Motive for the release tag 1.8:
 * This script will merge battles with rules that are imposed on cards rather than their behaviour
 * to Standard. just run once with last commented, if satisfied with the logs,
 * unComment last line and run */
const {readFileSync,writeFileSync} = require('jsonfile');
const battles = require('./battles-data');
const {_team,_dbug,log}=require('./helper');
/** you can use multiple files here*/
const old_battles = [...require('./data/battle_data.json'),/*...require('./data/any other file.json')*/];
var new_battles,older_battles_obj={};
try {
  // temporary file to store battle_data while cleaning or merging multiple older battle_data
  new_battles = readFileSync('./data/battle_data-temp.json')
}catch(e){
  log(e)
  new_battles = {}
}
old_battles.forEach(b=>{
  var obj = older_battles_obj;
  const [_,...rem] = b.teams.flat(2);
  for(let path of b.rule.split(','))obj=obj[path]??={};
  obj=obj[b.mana]??=[];
  obj.push(rem);
});
battles.merge(new_battles,older_battles_obj);
// unComment the following to permanently modify your battle_data or try with different name checkout the file and make it permanent
// if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
require('jsonfile').writeFileSync(`data/battle_data-temp.json`,new_battles)
log('done')
