const R = require('ramda')
const enumify =(ENUM_VALS,hash=R.identity)=>{
  let Enum = R.pipe (
    R.invertObj,
    R.map (R.add`0`),
    R.map (hash),
    R.juxt ([R.identity, R.invertObj]),
    R.mergeAll,
  ) (ENUM_VALS)
  return Object.freeze(Object.assign(x=>Enum[x],{...Enum,ENUM_VALS}))
}
module.exports.colorEnum = enumify (['Red','Blue','Green','Black','White','Gray','Gold'])
module.exports.ruleEnum = enumify ([
    'Back to Basics', 'Silenced Summoners', 'Aim True', 'Super Sneak', 'Weak Magic', 'Unprotected',
    'Target Practice', 'Fog of War', 'Armored Up', 'Equal Opportunity', 'Melee Mayhem', 'Healed Out',
    'Earthquake', 'Reverse Speed', 'Close Range', 'Heavy Hitters', 'Equalizer', 'Noxious Fumes',
    'Stampede', 'Explosive Weaponry', 'Holy Protection', 'Spreading Fury'
  ], R.add`-1`)
// console.log(module.exports.colorEnum,'Red,Blue'.split`,`.map(module.exports.colorEnum))
