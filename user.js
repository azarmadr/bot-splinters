const cards = require('./data/cards.json');
const log=(...m)=>console.log('user.js:',...m);

const userCards = {gold:{}};
//phantom cards available for the players but not visible in the api endpoint
require('./data/basicCards').filter(c=>c!=='').forEach(c=>userCards[c]=1);

getPlayerCards = (username) => require('async-get-json')(`https://game-api.splinterlands.io/cards/collection/${username}`)
  .then(({cards}) => cards.filter(x=>x.delegated_to === username || x.market_id === null)
    .forEach(({card_detail_id,level,gold}) => gold?
      (userCards.gold[card_detail_id]>level)||(userCards.gold[card_detail_id]=level):
      (userCards[card_detail_id]>level)||(userCards[card_detail_id]=level)
    )
  )
  .then(()=>{
    require('jsonfile').writeFile(`data/${username}_cards.json`, userCards, function (err) {
        if (err) { log(err); }
      });
    return userCards 
  })
  .catch(e => {log('Using only basic cards due to error when getting user collection from splinterlands: ',e); return userCards})

module.exports.getPlayerCards = getPlayerCards;
//const c= getPlayerCards('azarmadr3');Promise.resolve(c).then(log)
