export function initialState(configured = true) {
  return {
    phase: configured ? "loading" : "configuration",
    now: 0,
    user: null,
    errorMsg: "",
    busy: false,
    toast: null,            // {kind, message, gameId?, result?, corrected?}
    loginEmail: "", loginPassword: "",
    settings: null,
    tiers: [],              // rows from the tiers table, strongest first
    roster: [],             // every active player in the database
    // setup screen
    setupCourts: 2, picked: new Set(), newName: "", newUsername: "", newUsernameManual: false, newTier: "B",
    // live session
    session: null,
    players: [],            // here today: {id,name,elo,tier,gamesTotal,games,consec,status,pendingRemove,eloStart}
    courts: [],             // {id,no,game:{id,teamA:[id,id],teamB:[id,id]}|null,closing,holdStartedAt}
    nextCourtNo: 1,
    partnerHist: new Map(), // pairKey  -> weighted times partnered
    matchHist: new Map(),   // matchKey -> weighted times played
    recentMatches: [],      // matchKeys of today's finished games, oldest first
    lastPartner: new Map(), // playerId -> partner in their latest finished game today
    log: [],                // today's finished games, oldest first
    scoreDrafts: {},        // gameId -> {a, b}: score boxes as typed
    scoreSheet: null,       // {kind: "finish"|"correct", gameId, courtNo} while confirming a score
    names: new Map(),       // id -> name (includes people who have left)
    // panels
    showStats: false, showLog: false, showHelp: false, showManage: false, helpLang: "en",
    addExistingId: "",
  };
}
