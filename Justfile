get-battles: (test-js)
    nu -l etc/get-battles.nu

update-battles-db opts:
    node etc/insert_battles.js {{opts}}

refresh-battle-db: && (update-battles-db "-a")
    rm data/battles.db

test-js:
    # node util/common.js
    node --test test/main.js

get-rulesets:
    #!nu
    http https://api.splinterlands.com/battle/rulesets | save -f data/rulesets.json

get-cards player:
    #!nu
    http https://api.splinterlands.com/cards/collection/{{player}} | save data/test/{{player}}-cards.json
