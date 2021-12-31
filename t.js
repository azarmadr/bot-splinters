const {log} = require('./helper');
const args = require("minimist")(process.argv.slice(2));
const {readFileSync,writeFileSync} = require('jsonfile');

const { teamScores, playableTeams } = require("./score");
const oldBattles = require("./data/battle_data.json");

const drs = args.drs ?? "";
const player = args.name ?? "";
const depth = args.d ?? 2;
const fn = args.fn || "";
const battles = require("./battles-data");
const minRank = args.mr ?? 729;

if ("b" in args)
  Promise.resolve(battles.fromUsers(player, { depth, drs, fn, minRank })).then(
    () => {}
  );
if ("m" in args) {
  const bd = readFileSync(`./data/battle_data${fn}.json`);
  //const old_battles = [require('../bottle-data/battle_data.json'),require('./data/battle_data-new.json')];
  args.m
    .split(",")
    .map((x) => require(`${x}`))
    .forEach((ob) => log(typeof ob) ?? battles.merge(bd, ob));
  writeFileSync(`./data/battle_data${fn}.json`, bd);
  log(bd.Standard[12].length);
}
