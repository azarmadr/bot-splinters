update-battles-db:
    node etc/insert_battles.js

get-battles:
    nu etc/get-battles.nu

test-js:
    node --test test/main.js

get-splinterlands-info:
    #!nu
    http https://api.splinterlands.com/battle/rulesets | save -f data/rulesets.json
