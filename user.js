const cards = require('./data/cards.json');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const { cards, chunk2, addName} = require('./helper');

//basic cards of edition 1,4 with rarity < 3
const basicCards =(uc=[])=> cards.filter(c=>c.editions.match(/1|4/)&&c.rarity<3&&!uc.includes(c.id)).map(c=>[c.id,1]);

getPlayerCards = (username) => require('async-get-json')(`https://game-api.splinterlands.io/cards/collection/${username}`)
  .then(({cards}) => [...basicCards(cards.map(c=>c.card_detail_id)),...cards.filter(x=>x.delegated_to === username || x.market_id === null)
    .map(({card_detail_id,level,gold}) => gold?
      [card_detail_id,[level,'gold']]:
      [card_detail_id,level]
    )]
  )
  .then(cards=>{
    log(cards.length);
    const userCards = Object.fromEntries(cards);
    require('jsonfile').writeFile(`data/${username}_cards.json`, userCards).catch(log)
    return userCards
  })
  .catch(e => {log('Using only basic cards due to error when getting user collection from splinterlands: ',e); return Object.fromEntries(basicCards())})

module.exports.getPlayerCards = getPlayerCards;
//const c= getPlayerCards('azarmadr3');Promise.resolve(c).then(log)
