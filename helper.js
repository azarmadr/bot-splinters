require('dotenv').config()
const cards = require("./data/cards.json");
const myCards = require(`./data/${process.env.ACCOUNT}_cards.json`);

const cardColor=(c)=>cards[c.id-1]?.color;
const validDecks = ['Red', 'Blue', 'White', 'Black', 'Green']
const colorToDeck = { 'Red': 'Fire', 'Blue': 'Water', 'White': 'Life', 'Black': 'Death', 'Green': 'Earth' }

const deckValidColor=(accumulator,currentValue)=>validDecks.includes(cardColor(currentValue))?colorToDeck[cardColor(currentValue)]:accumulator;

const teamActualSplinterToPlay=(teamIdsArray)=>teamIdsArray.reduce(deckValidColor,'Fire')
const playableTeam = (team) => myCards[team.summoner.id]>=team.summoner.level && team.monsters.every(v=>myCards[v.id]>=v.level)
const addName = (card)=>{return{...card,name:cards[card.id-1].name}}
const cleanTeam=(team)=>{return{summoner:team.summoner,monsters:team.monsters}}
const cleanCard=(card)=>{return{id:card.id,level:card.level}}
const teamWithNames=(team)=>{
  return {summoner:addName(team.summoner),monsters:[...team.monsters.map(m=>addName(m))]}
}

//const teamIdsArray = [{"id":62,"level":1,"name":"Living Lava"},{"id":61,"level":1,"name":"Kobold Miner"}]; console.log(teamActualSplinterToPlay(teamIdsArray));
//console.log(cardColor({"id":224,"level":1,"name":"Drake of Arnak"}))

module.exports = {
  myCards, cardColor, teamActualSplinterToPlay, playableTeam, addName, cleanCard, cleanTeam,
  teamWithNames,
};
