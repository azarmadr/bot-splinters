const cards = require("./data/cards.json");

const color=(c)=>{return cards[c.id-1]?cards[c.id-1].color:''}
const validDecks = ['Red', 'Blue', 'White', 'Black', 'Green']
const colorToDeck = { 'Red': 'Fire', 'Blue': 'Water', 'White': 'Life', 'Black': 'Death', 'Green': 'Earth' }

const deckValidColor=(accumulator,currentValue)=>validDecks.includes(color(currentValue))?colorToDeck[color(currentValue)]:accumulator;

const teamActualSplinterToPlay=(teamIdsArray)=>teamIdsArray.reduce(deckValidColor,'Fire')

//const teamIdsArray = [{"id":62,"level":1,"name":"Living Lava"},{"id":61,"level":1,"name":"Kobold Miner"}]; console.log(teamActualSplinterToPlay(teamIdsArray));
//console.log(color({"id":224,"level":1,"name":"Drake of Arnak"}))

module.exports.color = color;
module.exports.teamActualSplinterToPlay = teamActualSplinterToPlay;
