// Supabase connection — copy both values from your Supabase dashboard:
// Project Settings → API (or "API Keys" / "Data API" in newer dashboards).
// The key here is the PUBLIC key (called "anon" or "publishable").
// Never put the "service_role" / "secret" key in this file.

// Running on this computer (localhost) uses the TEST project, so local
// testing never touches the real data. The deployed site uses production.
// (An empty hostname means the file was opened straight from disk.)
const IS_LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);

const PROD = {
  url: "https://yupitnoeqvifjfvxddob.supabase.co",
  key: "sb_publishable_B6LELFnvcqu5-V3ZTaAeqQ_B8R8-wQd",
};
const TEST = {
  url: "https://vewuzngvdpbjktzumvep.supabase.co",
  key: "sb_publishable_FKd1C5E82Yc4FSKrNgYETA_yZeGIomU",
};

const SUPABASE_URL = IS_LOCAL ? TEST.url : PROD.url;
const SUPABASE_ANON_KEY = IS_LOCAL ? TEST.key : PROD.key;
