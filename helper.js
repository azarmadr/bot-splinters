const cards = require("./data/cards.json");

const makeCardId = (id) => id;

const color = (id) => {
    const card = cards.find(o => o.id === id);
    const color = card && card.color ? card.color : '';
    return color;
}

// const teamIdsArray = [167, 192, 160, 161, 163, 196, '', 'fire'];

const validDecks = ['Red', 'Blue', 'White', 'Black', 'Green']
const colorToDeck = { 'Red': 'Fire', 'Blue': 'Water', 'White': 'Life', 'Black': 'Death', 'Green': 'Earth' }

const deckValidColor = (accumulator, currentValue) => validDecks.includes(color(currentValue.id)) ? colorToDeck[color(currentValue.id)] : accumulator;

//console.log(teamIdsArray.reduce(deckValidColor, ''));

const teamActualSplinterToPlay = (teamIdsArray) => teamIdsArray.reduce(deckValidColor, '')


module.exports.makeCardId = makeCardId;
module.exports.color = color;
module.exports.teamActualSplinterToPlay = teamActualSplinterToPlay;
