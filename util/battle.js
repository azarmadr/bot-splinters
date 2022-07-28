const R = require('ramda')
const {_team} = require('./card')
const {_dbug} = require('./dbug')

let battlesList;
Promise.resolve(require('jsonfile').readFile('./data/battle_data.json')).then(x=>battlesList=x).catch(e=>{
  let topBronzePlayers = require('sync-fetch')("https://api.splinterlands.io/players/leaderboard_with_player?leaderboard=0",{
      headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json().leaderboard;
  return require('../battles-data').fromUsers(topBronzePlayers.map(x=>x.player),{depth:2})
});
module.exports.B=function(battle){
  let mana = battle.mana_cap,
    myCards = {},
    oppCards = {},
    rules= require('./card').getRules(battle.ruleset),
    inactive= battle.inactive + (battle.ruleset.includes('Taking Sides') ? 'Gray' : ''),
    opp= battle.opponent_player,
    sortByWinRate=0;
  const isPlayable=_=>{
    // const cards = who?myCards:R.mergeWith(R.max,myCards,oppCards)
    const cards = myCards // until we have some opponent_player cards
    return x=>{
      const team = _team(x);
      return _team.mana(team)<=mana&&
        team.every(([i,l])=>cards[i]>=(l==1?0:l))&&
        _team.isActive(inactive)(team)&&
        rules.byTeam(team)
    }
  }
  return {
    get myCards(){return myCards},set myCards(_){myCards=_},
    get oppCards(){return oppCards},set oppCards(_){oppCards=_},
    get sortByWinRate(){return sortByWinRate},set sortByWinRate(_){sortByWinRate=_},
    mana,rules,inactive,opp,battlesList,isPlayable,
    nodeMatrix(io=0,minWinningTeams=1729/* ?disputable*/){
      minWinningTeams*=mana/9
      const {paths,predicate}=rules.pathsNpredicates;
      let nmSize = new Proxy({},{get:(o,n)=>o[n]??=0});
      const nm = R.sortBy(x=>((a,b)=>x>mana?x/a-mana/a:mana/b-x/b)(2,1),R.range(12,100))
        .map(paths).reduce((nm,paths,_,arr)=>{
          if(rules.card?.includes('Little League')&&paths[0].at(-1)>28) return nm
          paths.reduce((nm,path,i)=>require('./score')._score.bCopyBy(
            nm, R.pathOr({},path,battlesList),io, (t,s)=>s===undefined?predicate[i]:
            isPlayable(0)(t)?nmSize[path]++:isPlayable(1)(s)
          ),nm)
          if(R.reduce(R.add,0,R.values(nmSize))>(sortByWinRate?0.3:1)*minWinningTeams)arr.length=0;
          return nm;
        },{})
      _dbug.table(nmSize);
      return nm
    },
    unStarters(t){
      let team = _team(t)
      return team.reduce((count,[id])=>count+(myCards[id]>0),0)/team.length
    },
  }
}
