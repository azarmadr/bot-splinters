require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const player = args.name||process.env.ACCOUNT;
const fn = args.fn||'';
const score = require('./score').scores;
const battles = args.seq?require('./battles-data-seq'):require('./battles-data');
const cards = require('./data/cards.json');
const score_opt = {};
const x=require('./data/battle_data.json');
const winningTeams = require('./winningTeams').winningTeams;
const b=battles.battlesList(player,fn); Promise.resolve(b).then(x=>{
  //Promise.resolve(require('./user').getPlayerCards(player)).then(()=>{
    console.log(x.length);
    //console.log(score(x).Standard[12].team.playable[0]);
    console.log(Object.values(winningTeams(x,player,fn))[0][0].w[0]);
    //score_opt.filterOutByMana=true;score_opt.filterOutLowWR=true;score_opt.StandardOnly=true; const s = score(x,score_opt,'foscor'); console.log(s[12].team.playable[0])
    //score_opt.filterOutByMana=true;delete score_opt.StandardOnly;delete score_opt.filterOutLowWR; const s1 = score(x,score_opt,'sfo_score'); console.log(s1[12].team.playable[0])
  //})
})
