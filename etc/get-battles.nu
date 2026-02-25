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
  from json
  | if $in.type? == Surrender or $in.winner == DRAW {return {}} else {}
  | update cells -c ('{final_,}team{1,2}' | str expand) {proc-if-team}
  | update rounds {flatten -a}
  | update pre_battle {insert num 0}
  | update rounds {|i|
    $i.pre_battle ++ $in
    | upsert initiator {default '-'}
    # | upsert group_state {if $in == null {} else {}}
    # | move group_state --last
    | move num --first
    | each {if $in.hit_chance? == 1 {reject hit_chance hit_val} else {}}
  }
  | select -o ...('{rounds,{final_,}team{1,2}}' | str expand)
}
let AUTH = open data/auth.json

def proc-battles [] {
  where not is_surrender | reject is_surrender
  | move --first created_date ruleset settings winner
  | update created_date {into datetime}
  | update details {proc-details}
  | update settings {from json}
  | update winner {|i| if $in == DRAW {0} else if $in == $i.player_1 {1} else 2}
  | select details match_type created_date ruleset settings winner ...(
    '{battle_queue_id}_{1,2}' | str expand)
  | flatten details
# | describe | str replace -r '[,]' "$0\n" -a
}

def update-battles [] {
  $in ++ (open data/battles-processed.json)
  | uniq-by battle_queue_id_1 battle_queue_id_2
  # | do {select -o home away perks | compact -e home | table -e | print; $in}
  | save data/battles-processed1.json
  mv data/battles-processed1.json data/battles-processed.json
}
def "cleanup battles files" [] {
  glob data/battles.*json | each {open $in | $in.battles | proc-battles}
  | flatten
  | update-battles
  rm data/battles.*json -f
}

def main [] {
  cleanup battles files
  open data/battles-processed.json
  | where format? in [foundation]
  | select created_date player_1 player_2
  | rename d p1 p2
  | update d {into datetime}
  | sort-by d
  | reduce -f {} {|r a| $r | get p1 p2 | reduce -f $a {|p| upsert $p $r.d}}
  | transpose -d | rename p d | sort-by d | get p
  | wrap name | grid | print ''
}
