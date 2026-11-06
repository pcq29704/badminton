# Current database schema

This diagram combines `court_balancer_schema.sql` with the local migrations in `migrations/` and `supabase/migrations/`. The SQL files define eight application tables. The auth user and Storage bucket are Supabase-managed resources referenced by the project.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#243b5a", "primaryTextColor": "#f8fafc", "primaryBorderColor": "#93c5fd", "lineColor": "#cbd5e1", "secondaryColor": "#243b5a", "tertiaryColor": "#243b5a", "fontFamily": "Arial, sans-serif", "fontSize": "14px", "erTableBackground": "#243b5a", "textColor": "#f8fafc"}, "themeCSS": ".er.entityBox { fill: #f8fafc !important; } .er.attributeBoxOdd, .er.attributeBoxEven { fill: #243b5a !important; } .er.entityLabel, .er.attributeBoxOdd text, .er.attributeBoxEven text, .er.relationshipLabel { fill: #f8fafc !important; color: #f8fafc !important; } .er.entityLabel { fill: #111827 !important; color: #111827 !important; }"}}%%
erDiagram
    AUTH_USERS ||--o| ORGANISERS : "user_id"
    TIERS ||--o{ PLAYERS : "tier"
    SESSIONS ||--o{ SESSION_PLAYERS : "session_id"
    PLAYERS ||--o{ SESSION_PLAYERS : "player_id"
    SESSIONS ||--o{ COURTS : "session_id"
    SESSIONS ||--o{ GAMES : "session_id"
    COURTS ||--o{ GAMES : "court_id"
    GAMES ||--o{ GAME_PLAYERS : "game_id"
    PLAYERS ||--o{ GAME_PLAYERS : "player_id"
    TIERS ||--o{ GAME_PLAYERS : "tier_before / tier_after"

    AUTH_USERS {
        uuid id PK
    }

    ORGANISERS {
        uuid user_id PK,FK
        timestamptz created_at
    }

    SETTINGS {
        int id PK "single row; must equal 1"
        int tier_buffer
        numeric k_provisional
        numeric k_established
        int provisional_games
        int hold_minutes
        int balance_deadzone
        int target_points "game ends at 21"
        int cap_points "deuce cap 30"
        numeric mov_min "Elo multiplier, 1-point win"
        numeric mov_max "Elo multiplier, biggest win"
    }

    TIERS {
        text code PK
        int rank UK
        int seed_elo "nullable"
        int min_elo "nullable"
        boolean organiser_only
    }

    PLAYERS {
        bigint id PK
        text name UK "case/trim-insensitive unique"
        text username UK "case/trim-insensitive unique"
        text password "nullable; first-claim login"
        text profile_image_path "nullable"
        text background_image_path "nullable"
        numeric elo
        text tier FK
        int games_total
        boolean active
        timestamptz created_at
    }

    SESSIONS {
        bigint id PK
        text status
        boolean rank_new_games
        timestamptz started_at
        timestamptz ended_at "nullable"
    }

    SESSION_PLAYERS {
        bigint session_id PK,FK
        bigint player_id PK,FK
        int games
        int consec
        text status
        boolean pending_remove
        timestamptz joined_at
        timestamptz left_at "nullable"
    }

    COURTS {
        bigint id PK
        bigint session_id FK
        int court_no UK "unique with session_id"
        boolean closing
        timestamptz hold_started_at "nullable"
        timestamptz removed_at "nullable"
    }

    GAMES {
        bigint id PK
        bigint session_id FK
        bigint court_id FK
        boolean ranked
        text status
        char winner "nullable"
        smallint score_a "nullable; old games have none"
        smallint score_b "nullable"
        numeric mov_multiplier "nullable; M used for Elo"
        timestamptz started_at
        timestamptz ended_at "nullable"
    }

    GAME_PLAYERS {
        bigint game_id PK,FK
        bigint player_id PK,FK
        char team
        numeric elo_before "nullable"
        numeric elo_after "nullable"
        text tier_before FK "nullable"
        text tier_after FK "nullable"
        numeric k_used "nullable"
    }

    STORAGE_BUCKET {
        text id PK "player-profile-images"
        boolean public
        int file_size_limit "5 MiB"
        text allowed_mime_types "JPEG, PNG, WebP"
    }
```

## Key constraints

- `session_players` uses `(session_id, player_id)` as its primary key.
- `game_players` uses `(game_id, player_id)` as its primary key.
- A partial unique index allows only one active session, and another allows only one `playing` game per court.
- `courts` has a unique `(session_id, court_no)` pair.
- `games.ranked` defaults to `false`; `sessions.rank_new_games` defaults to `true` (the toggle is hidden in the UI) and controls the setting copied to new games.
- `games.score_a` / `score_b` are both set or both null. When set, they must follow the scoring rule (`private.score_problem`, using `settings.target_points` and `cap_points`) and agree with `winner`; a trigger on `games` enforces the rule for every write.
- `players.username` and both image paths come from the player profile migration. Profile images use the public `player-profile-images` bucket.
- The local SQL schema defines functions and RLS policies in addition to these tables; they are omitted from this entity relationship diagram.
