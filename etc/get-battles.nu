def proc-if-team [] {
  [$in.summoner] ++ $in.monsters
  | reject -o foil edition skin player color rating
  | reject -o abilities base_health gold mint killedBy
  | flatten state
  | where alive? != false
  | reject -o alive
  | rename -c {card_detail_id: id}
  | select id level uid
}

def proc-details [] {
  update cells -c ('{final_,}team{1,2}' | str expand) {proc-if-team}
  | update rounds {flatten -a}
  | update pre_battle {insert num 0}
  | update rounds {|i| # TODO process rounds and reject uid's
    $i.pre_battle ++ $in
    | upsert initiator {default '-'}
    # | upsert group_state {if $in == null {} else {}}
    # | move group_state --last
    | move num --first
    | each {if $in.hit_chance? == 1 {reject hit_chance hit_val} else {}}
  }
  | select -o ...('{rounds,{final_,}team{1,2}}' | str expand)
}

def proc-battles [] {
  where not is_surrender and winner != DRAW and match_type != Campaign
  | update details {from json}
  | move --first ruleset settings winner
  | update details {proc-details}
  | update settings {from json}
  | update winner {|i| if $in == DRAW {0} else if $in == $i.player_1 {1} else 2}
  | select details match_type ruleset settings winner ...(
    '{battle_queue_id}_{1,2}' | str expand)
  | flatten details
# | describe | str replace -r '[,]' "$0\n" -a
}

# TODO remove dependancy on battle_queue_id's
#      devise methods to work with the rounds
def prune-unwanted-battles [] {
  where battle_queue_id_1 !~ 'prologue|tutorial'
  | where team1? != null and team2? != null
  | reject -o home away perks created_date
  | uniq-by battle_queue_id_1 battle_queue_id_2
  # | do {select -o home away perks | compact -e home | table -e | print; $in}
}

def safe-backup [] {
  save -f data/battles-processed1.json
  ls data/battles-processed*.json | insert count {open $in.name | length} | collect | print
  mv data/battles-processed1.json data/battles-processed.json
}

def insert-into-db [] {
  let count = open data/battles.db | $in.battles | length | wrap old
  node etc/insert_battles.js | complete | if $in.exit_code != 0 {print}
  $count | insert new {open data/battles.db | $in.battles | length} | print
}

def update-battles [] {
  $in ++ (open data/battles-processed.json)
  | prune-unwanted-battles
  | safe-backup

  insert-into-db
}

def "cleanup battles files" [] {
  glob data/battles.*json | each {open $in | $in.battles | proc-battles}
  | flatten
  | update-battles
  rm data/battles.*json -f
}

def get-battles [u] {
  let b = http $'https://api.splinterlands.io/battle/history?player=($u)' -H (open data/auth.json)
  | $in.battles

  $b | proc-battles | update-battles

  $b
  | insert bad {$in.player_2_rating_final < 999 and $in.player_1_rating_final < 999}
  | select created_date player_1 player_2 bad
  | rename d p1 p2
  | update d {into datetime}
  | sort-by d
  | reduce -f {} {|r a| $r | get p1 p2 | reduce -f $a {|p|
    upsert $p ($r | select d bad)
  }}
  | update $u {update d (date now)}
  | transpose -d | flatten | rename p | sort-by d
}

def backup-processed [] {
  if (open data/battles-processed.json | length) < 5000 {return}

  open data/battles-processed.json data/processed/battles-*.json
  | prune-unwanted-battles
  | chunks 999 | enumerate
  | each {|i| $i.item | save -f $'data/processed/battles-($i.index).json'}

  open data\battles-processed.json | last 1111 | safe-backup
  insert-into-db
}

def handle-join-remnants [] {
  upsert d {|r| [$r.d? $r.d_?] | compact -e | math max} | reject -o d_
  | sort-by d
}

def main [] {
  # cleanup battles files
  backup-processed

  let user_f = 'data/user.nuon'
  let default_users = rg ACCOUNT= .env | lines | split row -r '[=,]' | skip | wrap p
  | insert d {0 | into datetime}
  if not ($user_f | path exists) { $default_users | save data/user.nuon }
  mut c = 3.
  loop {
    $c -= random float
    if $c < 0 {break}

    let users = open $user_f
    | where p != '???' and p !~ ' |^_slbb_'
    | join $default_users p -o
    | handle-join-remnants

    let next = $users | first
    print $'($c) ($next.p) ($next.d) out of ($users | length)'
    get-battles $next.p
    | join $users p -o
    | tee {where bad? == true | length
      | if $in > 0 {print $'($in) players with < 999 rating'}}
    | where bad? != true | reject -o bad
    | handle-join-remnants
    | update d {|i| if $i.p in $default_users.p {$in - 1hr} else {}}
    | save -f $user_f

    # $users | rename name | grid | print
    gum spin -- sleep 15
  }
}

export-env {
  $env.config.table.mode = 'compact'
}
