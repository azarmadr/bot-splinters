/** Motive for the release tag 1.8:
 * This script will merge battles with rules that are imposed on cards rather than their behaviour
 * to Standard. just run once with last commented, if satisfied with the logs,
 * unComment last line and run */
const {log,arrCmp}=require('./helper');
const old_battles = require('./data/battle_data.json');
const RS = 'Broken Arrows,Even Stevens,Keep Your Distance,Little League,Lost Legendaries,Lost Magic,Odd Ones Out,Rise of the Commons,Taking Sides,Up Close & Personal'
var rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
old_battles.forEach(b=>{
  if(b.rule=='Standard')rulecount.standard++;
  else if(b.rule.includes('|'))rulecount.mixed_rule++;
  else if(RS.includes(b.rule))rulecount.rules_for_cards++;
  else rulecount.unique++;
});log(rulecount);rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
let new_battles = old_battles.slice(0);
log(new_battles.length,old_battles.length)
new_battles.forEach(b=>delete b.date&&delete b.id&&RS.includes(b.rule)&&(b.rule='Standard'));
new_battles = [...new Map(new_battles.map(item =>
  [item.rule+item.mana+item.teams.sort(), item]
)).values()];
log(new_battles.length,old_battles.length)
new_battles.forEach(b=>{
  if(b.rule=='Standard')rulecount.standard++;
  else if(b.rule.includes('|'))rulecount.mixed_rule++;
  else if(RS.includes(b.rule))rulecount.rules_for_cards++;
  else rulecount.unique++;
});log(rulecount);rulecount = {standard:0,mixed_rule:0,rules_for_cards:0,unique:0}
// unComment the following to permanently modify your battle_data or try with different name checkout the file and make it permanent
//require('jsonfile').writeFileSync(`data/battle_data.json`,new_battles)
