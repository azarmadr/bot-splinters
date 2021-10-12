require('dotenv').config();
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const args = require('minimist')(process.argv.slice(2));

const {teamScores,playableTeams} = require('./score');
const cards                      = require('./data/cards.json');
const oldBattles                 = require('./data/battle_data.json');
const {winningTeams}             = require('./winningTeams');

const player  = args.name         ||process.env.ACCOUNT;
const fn      = args.fn           ||'';
const battles = args.seq          ?require('./battles-data-seq'):require('./battles-data');
const b       = args.freshBattles ?battles.battlesList(player,fn):oldBattles;

const score_opt = {};
Promise.resolve(b).then(x=>{
  //Promise.resolve(require('./user').getPlayerCards(player)).then(()=>{
    log(x.length);
    //log(score(x,{},fn).entries().next());
    log(playableTeams(teamScores(x,{}),player,27,'Standard',{},fn).entries().next());
    //log(Object.values(winningTeams(x,player,fn))[0][0].w[0]);
    //score_opt.filterOutByMana=true;score_opt.filterOutLowWR=true;score_opt.StandardOnly=true; const s = score(x,player,score_opt,'foscor'); log(s[12].team.playable[0])
    //score_opt.filterOutByMana=true;delete score_opt.StandardOnly;delete score_opt.filterOutLowWR; const s1 = score(x,score_opt,'sfo_score'); log(s1[12].team.playable[0])
  //})
})
