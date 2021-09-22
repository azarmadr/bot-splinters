require('dotenv').config()
const fs = require('fs');
const scores = {Standard: require(`./data/${process.env.ACCOUNT}_foscor.json`)};

function sortByProperty(property){
   return function(a,b){
      if(a[property] < b[property])
         return 1;
      else if(a[property] > b[property])
         return -1;
      return 0;
   }
}
function sortByWinRate(){
  return function(a,b){
    return (a.w*b.count<a.count*b.w) ? 1 :(a.w*b.count>a.count*b.w) ? -1 : 0;
  }
}
const cleanCard = (card) => {
  const {w, l, d, wr, score, scores, count, name, ...rem} = card;
  return rem
}

let cardAnalysis = { summoner: {owned: [],unowned: []}, monsters: {owned: [],unowned: []}};
Object.values(scores.Standard).forEach(m=>{
  var mana_cap = Object.keys(scores.Standard).find(k=>scores.Standard[k]===m)
  Object.keys(m.summoner).forEach(o=>{
    m.summoner[o].forEach(s => {
      var sf = cardAnalysis.summoner[o].find(e=>{
        return JSON.stringify(cleanCard(e)) === JSON.stringify(cleanCard(s))
      })
      if(sf) {
        sf.score += s.score; sf.count += s.count;
        sf.w += s.w; sf.d += s.d; sf.l += s.l;sf.scores[mana_cap]=s.score;
      }
      else {
        s.scores = {};s.scores[mana_cap]=s.score;
        cardAnalysis.summoner[o].push(s)
      }
    })})
  Object.keys(m.monsters).forEach(o=>{
    m.monsters[o].forEach(c => {
      var sf = cardAnalysis.monsters[o].find(e=>{
        return JSON.stringify(cleanCard(e)) === JSON.stringify(cleanCard(c))
      })
      if(sf) {
        sf.score += c.score; sf.count += c.count;
        sf.w += c.w; sf.d += c.d; sf.l += c.l;sf.scores[mana_cap]=c.score;
      }
      else {
        c.scores = {};c.scores[mana_cap]=c.score;
        cardAnalysis.monsters[o].push(c)
      }
    })})
})
Object.values(cardAnalysis).forEach(mon=>
  Object.values(mon).forEach(a=>a.sort(sortByWinRate())))//sortByProperty("score"))))
fs.writeFile(`data/${process.env.ACCOUNT}_cardAnalysis.json`, JSON.stringify(cardAnalysis), function (err) {
  if (err) {
    console.log(err);
  }
});
