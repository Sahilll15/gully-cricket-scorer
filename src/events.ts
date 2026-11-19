/** Analytics event names. The web app and the Android app both import these, so their reports line up. */
export const EV = {
  // Match lifecycle
  match_start: "match_start",
  innings_end: "innings_end",
  match_end: "match_end",
  super_over_start: "super_over_start",
  declare: "declare",
  stop_match: "stop_match",
  rematch: "rematch",
  // Scoring
  over_end: "over_end",
  wicket: "wicket",
  undo: "undo",
  redo: "redo",
  edit_ball: "edit_ball",
  swap_strike: "swap_strike",
  retire: "retire",
  ball_lost: "ball_lost",
  penalty: "penalty",
  rule_change: "rule_change",
  player_added: "player_added",
  player_left: "player_left",
  change_overs: "change_overs",
  // Tools
  voice_on: "voice_on",
  voice_off: "voice_off",
  voice_command: "voice_command",
  commentary_on: "commentary_on",
  wagon_wheel_on: "wagon_wheel_on",
  turf_timer_set: "turf_timer_set",
  wagon_zone_set: "wagon_zone_set",
  // Sharing
  live_share_start: "live_share_start",
  live_share_stop: "live_share_stop",
  watch_live: "watch_live",
  handover_start: "handover_start",
  move_scoring_in: "move_scoring_in",
  take_scoring_back: "take_scoring_back",
  share: "share",
  // Setup and people
  preset_pick: "preset_pick",
  fair_teams: "fair_teams",
  team_save: "team_save",
  team_delete: "team_delete",
  player_details_save: "player_details_save",
  merge_players: "merge_players",
  undo_merge: "undo_merge",
  group_save: "group_save",
  group_share: "group_share",
  group_import: "group_import",
  group_use: "group_use",
  rain_rule: "rain_rule",
  player_photo_set: "player_photo_set",
  group_board_share: "group_board_share",
  group_split: "group_split",
  group_poll: "group_poll",
  recap_share: "recap_share",
  result_prompt: "result_prompt",
  // Cups and series
  cup_create: "cup_create",
  cup_fixture_play: "cup_fixture_play",
  series_create: "series_create",
  // Gully Book
  book_section: "book_section",
  head_to_head: "head_to_head",
  rivalry: "rivalry",
  // Kitty
  kitty_expense: "kitty_expense",
  kitty_settle: "kitty_settle",
  kitty_mark_paid: "kitty_mark_paid",
  kitty_turf_split: "kitty_turf_split",
  kitty_stake: "kitty_stake",
  kitty_qr_show: "kitty_qr_show",
  ball_debt_resolve: "ball_debt_resolve",
  // Next game and backup
  next_game_save: "next_game_save",
  next_game_share: "next_game_share",
  reminder_set: "reminder_set",
  calendar_add: "calendar_add",
  backup_file_save: "backup_file_save",
  backup_file_restore: "backup_file_restore",
  sign_in: "sign_in",
  sign_out: "sign_out",
  account_delete: "account_delete",
  backup_sync: "backup_sync",
} as const;

export type EventName = (typeof EV)[keyof typeof EV];
export type EventParams = Record<string, string | number>;

/** The `what` param of the share event. */
export type ShareWhat =
  | "scorecard_image" | "highlights" | "text" | "poster_match" | "poster_winner" | "pdf" | "csv" | "book" | "skill_card" | "next_game";

/** What each scorecard or poster image kind is called in the share event. */
export const IMAGE_SHARE: Record<"full" | "card" | "match" | "winner", ShareWhat> = {
  full: "scorecard_image", card: "highlights", match: "poster_match", winner: "poster_winner",
};
