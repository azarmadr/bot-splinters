const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const args = require('minimist')(process.argv.slice(2));

const {teamScores,playableTeams} = require('./score');
const oldBattles                 = require('./data/battle_data.json');
//const {winningTeams}             = require('./winningTeams');

const player  = args.name??'';
const depth = args.d ?? 2;
const fn      = args.fn           ||'';
const battles = require('./battles-data');
const minRank = args.mr ?? 729;
const b       = (args.freshBattles||args.fb) ?battles.fromUsers(player,{depth,fn,minRank}):oldBattles;

Promise.resolve(b).then(x=>{
  //Promise.resolve(require('./user').getPlayerCards(player)).then(()=>{
    //log(x.length);
    //log(score(x,{},fn).entries().next());
    //log(playableTeams(teamScores(x,{}),player,27,'Standard',{},fn).entries().next());
    //log(Object.values(winningTeams(x,player,fn))[0][0].w[0]);
  //})
})
