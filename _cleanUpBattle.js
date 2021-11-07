/** Motive for the release tag 1.8:
 * This script will merge battles with rules that are imposed on cards rather than their behaviour
 * to Standard. just run once with last commented, if satisfied with the logs,
 * unComment last line and run */
const {_team,log,arrCmp}=require('./helper');
const old_battles = require('./data/battle_data-new.json');
var rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
old_battles.forEach(b=>{
  if(b.rule=='Standard')rulecount.standard++;
  else if(b.rule.includes('|'))rulecount.mixed_rule++;
  else if(_team.rules.secondary.includes(b.rule))rulecount.rules_for_cards++;
  else rulecount.unique++;
});log(rulecount);rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
var rt = {rs:{},nr:{}};
let new_battles = old_battles.slice(0);
new_battles.forEach(b=>{
  delete b.date;
  delete b.id;
  b.teams = b.teams.sort();
  if(b.rule in rt.rs){rt.rs[b.rule]++}else{rt.rs[b.rule]=0};
  b.rule = b.rule.split('|').reduce((rules,cr)=>{
    _team.rules.secondary.includes(cr)||rules.push(cr);
    return rules
  },[]).sort().join()||'Standard';
  if(b.rule in rt.nr){rt.nr[b.rule]++}else{rt.nr[b.rule]=0};
});
new_battles = [...new Map(new_battles.map(item =>
  [item.rule+item.mana+item.teams.sort(), item]
)).values()];
log({new:new_battles.length,old:old_battles.length})
log({rs:Object.keys(rt.rs).length,nr:Object.keys(rt.nr).length})
new_battles.forEach(b=>{
  if(b.rule=='Standard')rulecount.standard++;
  else if(b.rule.includes(','))rulecount.mixed_rule++;
  else if(_team.rules.secondary.includes(b.rule))rulecount.rules_for_cards++;
  else rulecount.unique++;
});log(rulecount);rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
// unComment the following to permanently modify your battle_data or try with different name checkout the file and make it permanent
require('jsonfile').writeFileSync(`data/battle_data-new.json`,new_battles)
