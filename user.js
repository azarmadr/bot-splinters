const fetch = require("node-fetch");
const cards = require('./data/cards.json');
const fs = require('fs');

const userCards = {};
//phantom cards available for the players but not visible in the api endpoint
require('./data/basicCards').filter(c=>c!=='').forEach(c=>userCards[c]=1);

getPlayerCards = (username) => (fetch(`https://game-api.splinterlands.io/cards/collection/${username}`,
  { "credentials": "omit", "headers": { "accept": "application/json, text/javascript, */*; q=0.01" }, "referrer": `https://splinterlands.com/?p=collection&a=${username}`, "referrerPolicy": "no-referrer-when-downgrade", "body": null, "method": "GET", "mode": "cors" })
  .then(x => x && x.json())
  .then(x => x['cards'] && x['cards'].filter(x=>x.delegated_to === username || x.market_id === null)
    .forEach(c => {
      (userCards[c.card_detail_id]<c.level)&&(userCards[c.card_detail_id]=c.level);
      c.gold&&(userCards.gold[c.card_detail_id]<c.level)&&(userCards.gold[c.card_detail_id]=c.level);
    })
  )
  .then(()=>{
    fs.writeFile(`data/${username}_cards.json`, JSON.stringify(userCards), function (err) {
        if (err) { console.log(err); }
      });
    return userCards 
  })
  .catch(e => {console.log('Using only basic cards due to error when getting user collection from splinterlands: ',e); return userCards})
)

//const c= getPlayerCards('azarmadr');Promise.resolve(c).then(y=>console.log(y))
module.exports.getPlayerCards = getPlayerCards;
