const R = require('ramda')
const RA = require('ramda-adjunct')
const {colorEnum} = require('./util/constants')
const {T,Ru,getRules,C} = require('./util/card')
const {log,_dbug} = require('./util/dbug')

const db = require('better-sqlite3')('./data/battles.db',
  {verbose:log,timeout:81e3}
);
const add2nm=(nm,io,s,t,r)=>{
  if(io){
    ((nm[s]??={})[t]??=[])[0]=r;
    ((nm[t]??={})[s]??=[])[1]=r;
  }else (nm[s]??={})[t]=r
}

module.exports = function BattleObj(battle){
  let mana =Math.min(
    battle.ruleset.includes('Little League')?28:99,
    battle.mana_cap
  ),
    myCards = {},
    oppCards = {},
    rules= getRules(battle.ruleset,1),
    inactive = `${battle.inactive}${battle.ruleset.includes`Taking Sides`?',Gray':''}`,
    opp= battle.opponent_player,
    sortByWinRate=0,
    isModern=/modern/.test(battle.format);
  const activeColors=R.range(0,24).filter(x=>
    ![5,11].includes(x)&&
    (inactive.includes`Gray`?x%12<6:1)&&
    (inactive.includes`Gold`?x<12:1)&&
    !inactive.includes(['Red','Blue','Green','Black','White'][x%6])
  )
  const aColors = activeColors.join()

  const query = db.prepare(`
    SELECT w,l,d,team1,team2 FROM battles WHERE (
      rules = '${R.pipe(
        Ru.map,
        R.toPairs,
        R.map (R.filter (RA.isNotNaN)),
        R.map (R.join`' AND r & `),
        R.join` > 0 OR\n      rules = '`
      ) (rules.attr)}'
    ) AND (
      w = 1 AND (m1 = :mana ${mana>31?` OR m1<=${mana} AND m1 > 30`:``}) AND c1 IN (${aColors}) OR
      l = 1 AND (m2 = :mana ${mana>31?` OR m2<=${mana} AND m2 > 30`:``}) AND c2 IN (${aColors}) OR
      (m1 = :mana ${mana>31?` OR m1<=${mana} AND m1 > 30`:``}) AND (m1 = m2${mana>31?` OR m2<=${mana} AND m2>30`:``}) AND
      c1 IN (${aColors}) AND c2 IN (${aColors})
    )
  `)
  // log(query.get({mana:23}))
  const isPlayable=by=>{
    let cards = [myCards,oppCards][by??=0] // until we have some opponent_player cards
    return x=>T(x).every(([i,l])=>cards[i]>=(l==1?by:l))
  }
  return {
    get myCards(){return myCards},set myCards(_){
      myCards = R.pipe(
        R.toPairs,
        R.filter (rules.byCard),
        R.filter (x=>!inactive.includes(C.color(x))),
        R.filter (isModern?C.isModern:R.T),
        R.fromPairs
      ) (_);
      // log(R.map (R.juxt ([R.identity,C.color,(x=>!inactive.includes(C.color(x))),rules.byCard,C.r])) (
      //   R.difference (R.toPairs (_), R.toPairs (myCards))
      // ))
    },
    get oppCards(){return oppCards},set oppCards(_){oppCards=_},
    get sortByWinRate(){return sortByWinRate},set sortByWinRate(_){sortByWinRate=_},
    mana,rules,inactive,opp,isPlayable,
    nodeMatrix(io=0,minWinningTeams=1729*mana/9/(rules.attr.length>1?9:1)/* ?disputable*/){
      log({minWinningTeams})
      let nmSize = new Proxy({},{get:(o,n)=>o[n]??=0});
      // x=>((a,b)=>x>mana?x/a-mana/a:mana/b-x/b)(2,1),
      let timeLimit = Date.now() + (practiceOn?27e3:81e3)
      const nm = RA.rangeStep(-1,mana,8).reduce((nm,Mana,_,arr)=>{
        if(timeLimit<Date.now()||mana>31&&Mana>31) return nm
        let battles = query.all({mana:Math.floor(Mana)});
        for(let {w,l,d,team1,team2} of battles){
          if(w||d)nmSize[Mana]+=+isPlayable(0)(team1);
          if(l||d)nmSize[Mana]+=+isPlayable(0)(team2);
          let s=w?team2:team1,t=w?team1:team2;
          if(w==l){
            add2nm(nm,io,s,t,2)
            add2nm(nm,io,t,s,2)
          }else{
            if(d){
              add2nm(nm,io,s,t,3)
              add2nm(nm,io,t,s,1)
            }else{
              add2nm(nm,io,s,t,4)
            }
          }
        }
        log({[`${rules}|${Mana}`]:`${nmSize[Mana]}/${battles.length}`})
        if(R.reduce(R.add,0,R.values(nmSize))>(sortByWinRate||practiceOn?0.027:1)*minWinningTeams)arr.length=0;
        return nm;
      },{})
      _dbug.table(nmSize);
      return nm
    },
    unStarters(t){
      let team = T(t)
      return team.reduce((count,[id])=>count+(myCards[id]>0),0)/team.length
    },
    get clone(){
      return BattleObj(battle)
    }
  }
}
