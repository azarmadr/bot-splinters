const {log} = require('./util');
const args = require("minimist")(process.argv.slice(2));
const {readFileSync,writeFileSync} = require('jsonfile');

const drs = args.drs ?? "";
const player = args.n ?? "";
const depth = args.d ?? 2;
const fn = args.f || "";
const {fromUsers,merge} = require("./battles-data");
const minRank = args.mr ?? 0;

if ("b" in args){
  log({drs,player,depth,fn,minRank});
  Promise.resolve(fromUsers(player, { depth, drs, fn, minRank })).then(
    () => {}
  );
}else if ("m" in args) {
  const bd = readFileSync(`./data/battle_data${fn}.json`);
  args.m
    .split(",")
    .map((x) => require(`${x}`))
    .forEach((ob) => log(typeof ob) ?? merge(bd, ob));
  writeFileSync(`./data/battle_data${fn}.json`, bd);
} else log({m:'merge',b:'battles'});
