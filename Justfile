get-battles: (test-js)
    nu -l etc/get-battles.nu

update-battles-db:
    node etc/insert_battles.js

test-js:
    node util/common.js
    node --test test/main.js

get-splinterlands-info:
    #!nu
    http https://api.splinterlands.com/battle/rulesets | save -f data/rulesets.json
