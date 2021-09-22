require('dotenv').config()
const fetch = require("node-fetch");
const cards = require('./data/cards.json');
const fs = require('fs');

const getCardName = (id) => cards.find(e => e.id === id).name;

const basicCards = require('./data/basicCards').filter(c=>c!=='').map(c => {
  return { id: c, level: 1, gold: false, name: getCardName(c), }
}); //phantom cards available for the players but not visible in the api endpoint

getPlayerCards = (username) => (fetch(`https://game-api.splinterlands.io/cards/collection/${username}`,
  { "credentials": "omit", "headers": { "accept": "application/json, text/javascript, */*; q=0.01" }, "referrer": `https://splinterlands.com/?p=collection&a=${username}`, "referrerPolicy": "no-referrer-when-downgrade", "body": null, "method": "GET", "mode": "cors" })
  .then(x => x && x.json())
  .then(x => x['cards'] ? x['cards'].filter(x=>x.delegated_to === username || x.market_id === null).map(card => {
    return {
      id: card.card_detail_id,
      level: card.level,
      gold: card.gold,
      name: getCardName(card.card_detail_id),
    }
    }) : '')
  .then(advanced => advanced.concat(basicCards.filter(c => {return !advanced.find(x => c.id === x.id)})))
  .then(cards=>{
    fs.writeFile(`data/${process.env.ACCOUNT}_cards.json`, JSON.stringify(cards), function (err) {
        if (err) {
          console.log(err);
        }
      });
    return cards
  })
  //.then(()=>console.log(basicCards.filter(c => {return !advanced.find(x => c.id === x.id)})))
  .catch(e => {console.log('Using only basic cards due to error when getting user collection from splinterlands: ',e); return basicCards})
)

//const c= getPlayerCards(process.env.ACCOUNT);Promise.resolve(c).then( y=>console.log(y.sort()))
module.exports.getPlayerCards = getPlayerCards;
