const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const args = require('minimist')(process.argv.slice(2));

const {teamScores,playableTeams} = require('./score');
const oldBattles                 = require('./data/battle_data.json');
//const {winningTeams}             = require('./winningTeams');

const drs = args.drs??''
const player  = args.name??'';
const depth = args.d ?? 2;
const fn      = args.fn           ||'';
const battles = require('./battles-data');
const minRank = args.mr ?? 729;
const b       = (args.freshBattles||args.fb) ?battles.fromUsers(player,{depth,drs,fn,minRank}):oldBattles;

Promise.resolve(b).then(()=>{ })
