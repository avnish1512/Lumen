// High-performance JAV Catalog & Caching API for Lord Profile

export type JavPost = {
  id: number
  title: string
  slug: string
  date: string
  thumbnail: string
  duration: string
  categories: string[]
  tags: string[]
  actors: string[]
  studio: string
  code: string
  views: number
  likes: number
  dislikes: number
  is_hd: boolean
  player_api: string
  embed_url: string
  embedUrl?: string
  iframe_html: string
}

export type JavCatalogResult = {
  posts: JavPost[]
  totalPosts: number
  totalPages: number
}

// 24 Pre-warmed top popular JAV videos for instantaneous (0ms) first-load display
export const INITIAL_JAV_POSTS: JavPost[] = [
  {
    "id": 66233,
    "title": "IPX-552 The Tables Have Been Turned! I Ordered A Delivery Health Call Girl Who Would Instantly Suck My Dick, And They Sent Me My Lady Boss, Who Is Always Bullying Me At Work. She Always Yells At Me With Contempt, \"You Really Piss Me Off!!\" Tsubasa Amami – Amami Tsubasa",
    "slug": "ipx-552-the-tables-have-been-turned-i-ordered-a-delivery-health-call-girl-who-would-instantly-suck-my-dick-and-they-sent-me-my-lady-boss-who-is-always-bullying-me-at-work-she-always-yells-at-me-wi",
    "date": "2025-12-29T03:27:16+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/ipx-552-english-subtitle/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Creampie",
      "English Subtitle",
      "Exclusive",
      "Female Boss",
      "Hd",
      "Individual",
      "Japanese",
      "Prostitute",
      "Selfie",
      "Sister",
      "Slim Pixelated"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Amami Tsubasa",
      "Daiki Takeda"
    ],
    "studio": "IdeaPocket",
    "code": "IPX-552-ENGLISH-SUBTITLE",
    "views": 60002,
    "likes": 1309,
    "dislikes": 248,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/66233",
    "embed_url": "https://server.apijav.com/?mvapm_embed=66233",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=66233\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 43861,
    "title": "PP004 Gonzo Fallen Angel No.004 Erica",
    "slug": "pp004-gonzo-fallen-angel-no-004-erica",
    "date": "2025-12-28T04:54:18+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/pp004/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Japanese",
      "Tokyohot"
    ],
    "tags": [
      "123av",
      "amateur",
      "Big Breasts",
      "Blow",
      "Creampie",
      "Cunnilingus",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "PP004",
    "views": 60002,
    "likes": 2570,
    "dislikes": 356,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/43861",
    "embed_url": "https://server.apijav.com/?mvapm_embed=43861",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=43861\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 1841,
    "title": "H0930-KI221231 Emi Makihara Age 40",
    "slug": "h0930-ki221231-emi-makihara-age-40",
    "date": "2025-12-23T07:52:30+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/h0930-ki221231/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "En/naughty0930",
      "Japanese"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "H0930-KI221231",
    "views": 60000,
    "likes": 2755,
    "dislikes": 263,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/1841",
    "embed_url": "https://server.apijav.com/?mvapm_embed=1841",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=1841\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 20618,
    "title": "XVT-030 A woman who wants to be exploited with cum swallowing and creampie Azusa Misaki",
    "slug": "xvt-030-a-woman-who-wants-to-be-exploited-with-cum-swallowing-and-creampie-azusa-misaki",
    "date": "2025-12-24T02:25:22+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/xvt-030/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Creampie",
      "Exclusive",
      "Hd",
      "Individual",
      "Japanese",
      "Oral Sex",
      "Pantyhose",
      "Release",
      "Ride",
      "Swallow Sperm"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Azusa Misaki"
    ],
    "studio": "Max-A",
    "code": "XVT-030",
    "views": 60000,
    "likes": 2635,
    "dislikes": 356,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/20618",
    "embed_url": "https://server.apijav.com/?mvapm_embed=20618",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=20618\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 102051,
    "title": "HUNTC-351 My popularity has finally arrived!? In a weak baseball club where there are more female managers than members, in order to keep me on, unlimited creampies are allowed and home runs are being hit one after another! The seniors have graduated and there are only two members left, including me! Now there are six female managers, more than members!",
    "slug": "huntc-351-my-popularity-has-finally-arrived-in-a-weak-baseball-club-where-there-are-more-female-managers-than-members-in-order-to-keep-me-on-unlimited-creampies-are-allowed-and-home-runs-are-being",
    "date": "2026-02-10T06:51:22+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/huntc-351-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Creampie",
      "Exclusive",
      "Hd",
      "High School Girl",
      "Japanese",
      "Oral Sex",
      "Orgy",
      "Ride",
      "Uncensored leak"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "Hunter",
    "code": "HUNTC-351-UNCENSORED-LEAK",
    "views": 60000,
    "likes": 1263,
    "dislikes": 389,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/102051",
    "embed_url": "https://server.apijav.com/?mvapm_embed=102051",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=102051\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 40638,
    "title": "MISM-324 RE Anal throat concave vagina hole loose acme 3 holes that don't stop the most crazy punk stimulation full power all holes ecstatic sex Otokoto Rui – Rui Otokoto",
    "slug": "mism-324-re-anal-throat-concave-vagina-hole-loose-acme-3-holes-that-dont-stop-the-most-crazy-punk-stimulation-full-power-all-holes-ecstatic-sex-otokoto-rui-rui-otokoto",
    "date": "2025-12-28T03:03:39+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/mism-324-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Anal Sex",
      "Exclusive",
      "Forced Blowjob",
      "Hd",
      "Individual",
      "Japanese",
      "Orgy",
      "Promiscuous",
      "Sm",
      "Uncensored leak"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Pierre Sword",
      "Rui Otokoto",
      "Samejima",
      "Tech"
    ],
    "studio": "えむっ娘ラボ",
    "code": "MISM-324-UNCENSORED-LEAK",
    "views": 60000,
    "likes": 2889,
    "dislikes": 319,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/40638",
    "embed_url": "https://server.apijav.com/?mvapm_embed=40638",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=40638\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 55795,
    "title": "FC2-PPV-1415480 [Private shoot/creampie] Massive ejaculations on a slender girl who looks like Nagasawa M*mi! The best girl who is dangerous in a good way and will forgive you even if you cum inside her with a smile [Yes]",
    "slug": "fc2-ppv-1415480-private-shoot-creampie-massive-ejaculations-on-a-slender-girl-who-looks-like-nagasawa-mmi-the-best-girl-who-is-dangerous-in-a-good-way-and-will-forgive-you-even-if-you-cum-inside-h",
    "date": "2025-12-28T11:25:26+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-1415480/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-1415480",
    "views": 60000,
    "likes": 2169,
    "dislikes": 213,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/55795",
    "embed_url": "https://server.apijav.com/?mvapm_embed=55795",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=55795\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 14887,
    "title": "SDJS-155 SOD female employees with 2 great benefits (*´ε'*) Kiss kiss (kiss) year-end party 2024 700 minutes 11 people Super orgy! 8 hospitality corners & individual SEX entertainment Mouth, whole body, and penis stick! Excuse me for the free kiss! Let me express my gratitude for the year with my upper and lower mouths! – Tsukino Saito",
    "slug": "sdjs-155-sod-female-employees-with-2-great-benefits-ceb5-kiss-kiss-kiss-year-end-party-2024-700-minutes-11-people-super-orgy-8-hospitality-corners-individual-sex-entertainment-mouth",
    "date": "2025-12-23T13:48:07+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/sdjs-155/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "4 Hours Or More",
      "4K",
      "Glasses Girl",
      "Hd",
      "Japanese",
      "Kiss",
      "Ol",
      "Planning",
      "Promiscuity",
      "Release"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Ayaka Yoshii",
      "China Izawa",
      "Endo Miharu",
      "Kajio Uta",
      "Moehisa Hishinuma",
      "Okamoto Fuuri",
      "Sano Seiya",
      "Sekiguchi Manyo",
      "Taniguchi Shuka",
      "Terakado Sayaka",
      "Tsukino Saito"
    ],
    "studio": "SOD",
    "code": "SDJS-155",
    "views": 60000,
    "likes": 1234,
    "dislikes": 327,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/14887",
    "embed_url": "https://server.apijav.com/?mvapm_embed=14887",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=14887\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 87094,
    "title": "NIMA-074 Live-action version: I've been changed. Until an office lady in her 30s becomes addicted to the dicks of college students. Yuria Yoshine",
    "slug": "nima-074-live-action-version-ive-been-changed-until-an-office-lady-in-her-30s-becomes-addicted-to-the-dicks-of-college-students-yuria-yoshine",
    "date": "2026-01-05T09:29:57+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/nima-074-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Big Breasts",
      "Exclusive",
      "Hd",
      "Individual",
      "Japanese",
      "Ntr",
      "Original",
      "Promiscuity",
      "Tit Job",
      "Uncensored leak"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Haruto Terahashi",
      "Jun Odagiri",
      "Seigo Hashimoto",
      "Tech",
      "Yuria Yoshine"
    ],
    "studio": "Fitch",
    "code": "NIMA-074-UNCENSORED-LEAK",
    "views": 59999,
    "likes": 1186,
    "dislikes": 422,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/87094",
    "embed_url": "https://server.apijav.com/?mvapm_embed=87094",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=87094\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 53049,
    "title": "FC2-PPV-3600282 Transformational Married Women's Sexual Love Site Delivery One Unre-exciting Junior In AV! Transformational wife and play stay in bed, all capital exposed!",
    "slug": "fc2-ppv-3600282-transformational-married-womens-sexual-love-site-delivery-one-unre-exciting-junior-in-av-transformational-wife-and-play-stay-in-bed-all-capital-exposed",
    "date": "2025-12-28T09:58:25+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-3600282/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "3P",
      "Adultery",
      "Big Breasts",
      "bridge",
      "crow",
      "Japanese",
      "JAV",
      "Jav Porn",
      "Ntr",
      "point of view",
      "Selfie",
      "Uncensored",
      "wheel type"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-3600282",
    "views": 59999,
    "likes": 2462,
    "dislikes": 225,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/53049",
    "embed_url": "https://server.apijav.com/?mvapm_embed=53049",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=53049\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 80072,
    "title": "FC2-PPV-4782304 [990 points until 11/7] [First shoot] Fair-skinned, slender half-Japanese flight attendant. She drank too much on vacation and missed the last train, so she's coming over to my place for more drinks. I'll fill her wet pussy with my big cock and pour hot semen into the depths of her vagina.",
    "slug": "fc2-ppv-4782304-990-points-until-11-7-first-shoot-fair-skinned-slender-half-japanese-flight-attendant-she-drank-too-much-on-vacation-and-missed-the-last-train-so-shes-coming-over-to-my-place-f",
    "date": "2026-01-04T10:56:37+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-4782304/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Ordinary Person",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "FC2",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "Fc2",
    "code": "FC2-PPV-4782304",
    "views": 59999,
    "likes": 2544,
    "dislikes": 261,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/80072",
    "embed_url": "https://server.apijav.com/?mvapm_embed=80072",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=80072\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 55178,
    "title": "FC2-PPV-4322453 Easy way G cup beauty is outside **♡ Primitive secret way.",
    "slug": "fc2-ppv-4322453-easy-way-g-cup-beauty-is-outside-e299a1-primitive-secret-way",
    "date": "2025-12-28T11:05:52+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-4322453/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "amateur",
      "Beautiful Breasts",
      "Big Breasts",
      "Buttocks",
      "High grade",
      "Japanese",
      "JAV",
      "Jav Porn",
      "Mochi",
      "point of view",
      "Selfie",
      "Uncensored",
      "Underwear"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-4322453",
    "views": 59999,
    "likes": 2737,
    "dislikes": 281,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/55178",
    "embed_url": "https://server.apijav.com/?mvapm_embed=55178",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=55178\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 84375,
    "title": "DANDY-987 \"Sorry for making my penis so big\" My nephew thought it would be okay because it was small, but when he got into the women's only car with me, he got a full erection in a situation full of boobs! My aunt, in a panic, secretly pulled it out for me",
    "slug": "dandy-987-sorry-for-making-my-penis-so-big-my-nephew-thought-it-would-be-okay-because-it-was-small-but-when-he-got-into-the-womens-only-car-with-me-he-got-a-full-erection-in-a-situation-full-of-b",
    "date": "2026-01-04T13:53:44+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/dandy-987-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "4K",
      "Aunt",
      "Big Breasts",
      "Bukkake",
      "Hd",
      "Japanese",
      "Masturbation",
      "Oral Sex",
      "Uncensored leak"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "DANDY",
    "code": "DANDY-987-UNCENSORED-LEAK",
    "views": 59998,
    "likes": 1064,
    "dislikes": 330,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/84375",
    "embed_url": "https://server.apijav.com/?mvapm_embed=84375",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=84375\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 4682,
    "title": "JUFE-440 Ai Sayama, Who Was Trained By A Married Female Teacher With Colossal Tits On A School Trip And Made A Vibe – Sayama Love",
    "slug": "jufe-440-ai-sayama-who-was-trained-by-a-married-female-teacher-with-colossal-tits-on-a-school-trip-and-made-a-vibe-sayama-love",
    "date": "2025-12-23T09:03:35+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/jufe-440-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Big Breasts",
      "Creampie",
      "Dirty Talk",
      "Exclusive",
      "Female Teacher",
      "Hd",
      "Individual",
      "Japanese",
      "Slut",
      "Uncensored leak"
    ],
    "tags": [
      "123av",
      "Big Breasts",
      "Creampie",
      "Dirty Talk",
      "Exclusive",
      "Female Teacher",
      "Hd",
      "Individual",
      "Japanese",
      "JAV",
      "Jav Porn",
      "Slut",
      "Uncensored leak"
    ],
    "actors": [
      "Sayama Love"
    ],
    "studio": "Fitch",
    "code": "JUFE-440-UNCENSORED-LEAK",
    "views": 59998,
    "likes": 1408,
    "dislikes": 182,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/4682",
    "embed_url": "https://server.apijav.com/?mvapm_embed=4682",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=4682\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 19807,
    "title": "GRMR-163 Human Observation: She's in a bad mood and keeps fighting even during work, so her normally cool boss boyfriend suddenly loses his cool! Obsessive marking and creampie sex in the conference room",
    "slug": "grmr-163-human-observation-shes-in-a-bad-mood-and-keeps-fighting-even-during-work-so-her-normally-cool-boss-boyfriend-suddenly-loses-his-cool-obsessive-marking-and-creampie-sex-in-the-conference-r",
    "date": "2025-12-24T02:04:42+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/grmr-163/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Beautiful Breasts",
      "Feminine",
      "Hd",
      "Japanese",
      "Ordinary Person",
      "Release",
      "Slim",
      "Sneak Shots"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "ムラっch",
    "code": "GRMR-163",
    "views": 59998,
    "likes": 2943,
    "dislikes": 379,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/19807",
    "embed_url": "https://server.apijav.com/?mvapm_embed=19807",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=19807\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 74680,
    "title": "ROE-321 Every weekend after a drinking party, my drunk female boss tempts me with her shiny pantyhose and we have an affair at a karaoke bar. Yuka Mizuno",
    "slug": "roe-321-every-weekend-after-a-drinking-party-my-drunk-female-boss-tempts-me-with-her-shiny-pantyhose-and-we-have-an-affair-at-a-karaoke-bar-yuka-mizuno-2",
    "date": "2026-01-04T07:33:18+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/roe-321-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Adultery",
      "Creampie",
      "Exclusive",
      "Hd",
      "Individual",
      "Japanese",
      "Mature Woman",
      "Pantyhose",
      "Uncensored leak",
      "Wife"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Yuka Mizuno"
    ],
    "studio": "Madonna",
    "code": "ROE-321-UNCENSORED-LEAK",
    "views": 59998,
    "likes": 1030,
    "dislikes": 363,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/74680",
    "embed_url": "https://server.apijav.com/?mvapm_embed=74680",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=74680\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 75001,
    "title": "START-267 My sister became a single mother and returned to her parents' home, where she gave birth to her virginity to her brother, who gave her his first experience. – Manami Yano",
    "slug": "start-267-my-sister-became-a-single-mother-and-returned-to-her-parents-home-where-she-gave-birth-to-her-virginity-to-her-brother-who-gave-her-his-first-experience-manami-yano-2",
    "date": "2026-01-04T07:47:11+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/start-267-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "4K",
      "Big Breasts",
      "Hd",
      "Individual",
      "Japanese",
      "Plot",
      "Tit Job",
      "Uncensored leak",
      "Various Occupations"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Manami Yano"
    ],
    "studio": "SOD",
    "code": "START-267-UNCENSORED-LEAK",
    "views": 59998,
    "likes": 1419,
    "dislikes": 205,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/75001",
    "embed_url": "https://server.apijav.com/?mvapm_embed=75001",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=75001\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 63689,
    "title": "STARS-060 Iori Furukawa What would you do if you were persuaded by a junior cunnilingus when you were a professional student?",
    "slug": "stars-060-iori-furukawa-what-would-you-do-if-you-were-persuaded-by-a-junior-cunnilingus-when-you-were-a-professional-student",
    "date": "2025-12-29T01:53:36+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/stars-060-english-subtitle/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Documentary",
      "English Subtitle",
      "Hd",
      "Individual",
      "Japanese",
      "Sister",
      "Sneak Shots"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Iori Furukawa",
      "Yo Ashida"
    ],
    "studio": "SOD",
    "code": "STARS-060-ENGLISH-SUBTITLE",
    "views": 59998,
    "likes": 2135,
    "dislikes": 425,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/63689",
    "embed_url": "https://server.apijav.com/?mvapm_embed=63689",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=63689\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 57715,
    "title": "FC2-PPV-4529075 An undeveloped Japanese spear!",
    "slug": "fc2-ppv-4529075-an-undeveloped-japanese-spear",
    "date": "2025-12-28T12:26:12+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-4529075/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "amateur",
      "Big Breasts",
      "Breast massage",
      "exercise chest",
      "Japanese",
      "JAV",
      "Jav Porn",
      "Masturbation spear",
      "mountain bird",
      "Original",
      "school ancestors",
      "Selfie",
      "shooting"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-4529075",
    "views": 59998,
    "likes": 1850,
    "dislikes": 381,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/57715",
    "embed_url": "https://server.apijav.com/?mvapm_embed=57715",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=57715\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 77429,
    "title": "FC2-PPV-4654481 *Comprehensive Review Award",
    "slug": "fc2-ppv-4654481-comprehensive-review-award",
    "date": "2026-01-04T09:17:27+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-4654481/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-4654481",
    "views": 59997,
    "likes": 1755,
    "dislikes": 490,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/77429",
    "embed_url": "https://server.apijav.com/?mvapm_embed=77429",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=77429\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 56098,
    "title": "FC2-PPV-2632543 A girl in uniform I met on the train fluttered her skirt and showed me her panties pa0019 [Yes]",
    "slug": "fc2-ppv-2632543-a-girl-in-uniform-i-met-on-the-train-fluttered-her-skirt-and-showed-me-her-panties-pa0019-yes",
    "date": "2025-12-28T11:34:34+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/fc2-ppv-2632543/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Fc2",
      "Japanese",
      "Uncensored"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "FC2-PPV-2632543",
    "views": 59997,
    "likes": 1877,
    "dislikes": 303,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/56098",
    "embed_url": "https://server.apijav.com/?mvapm_embed=56098",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=56098\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 92125,
    "title": "SONE-073 The beautiful swimmer was prepared with a swimsuit that was so big her nipples were about to pop out. – Riri Nanatsumori",
    "slug": "sone-073-the-beautiful-swimmer-was-prepared-with-a-swimsuit-that-was-so-big-her-nipples-were-about-to-pop-out-riri-nanatsumori-2",
    "date": "2026-01-05T13:33:15+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/sone-073-english-subtitle/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "4K",
      "English Subtitle",
      "Exclusive",
      "Hd",
      "Humiliation",
      "Individual",
      "Japanese",
      "Promiscuous",
      "Slim",
      "Sneak Shots",
      "Swimsuit"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Danka",
      "Eriguchi",
      "Riri Nanatsumori",
      "Seigo Hashimoto"
    ],
    "studio": "S1",
    "code": "SONE-073-ENGLISH-SUBTITLE",
    "views": 59997,
    "likes": 1821,
    "dislikes": 306,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/92125",
    "embed_url": "https://server.apijav.com/?mvapm_embed=92125",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=92125\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 3275,
    "title": "H4610-KI201222 Miu Suzuki 25 years old",
    "slug": "h4610-ki201222-miu-suzuki-25-years-old",
    "date": "2025-12-23T08:34:35+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/h4610-ki201222/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Japanese",
      "Naughty4610"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [],
    "studio": "",
    "code": "H4610-KI201222",
    "views": 59997,
    "likes": 1757,
    "dislikes": 165,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/3275",
    "embed_url": "https://server.apijav.com/?mvapm_embed=3275",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=3275\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  },
  {
    "id": 83854,
    "title": "NGOD-272 An affair that begins with a kiss with a female friend who is more comfortable than my wife. An unstoppable saliva exchange kissing sex. Yui Hatano",
    "slug": "ngod-272-an-affair-that-begins-with-a-kiss-with-a-female-friend-who-is-more-comfortable-than-my-wife-an-unstoppable-saliva-exchange-kissing-sex-yui-hatano",
    "date": "2026-01-04T13:30:04+08:00",
    "thumbnail": "https://fourhoi.mrstcdn.store/ngod-272-uncensored-leak/cover-n.jpg",
    "duration": "00:00:00",
    "categories": [
      "123av",
      "Adultery",
      "Big Breasts",
      "Exclusive",
      "Hd",
      "Individual",
      "Japanese",
      "Mature Woman",
      "Ntr",
      "Uncensored leak",
      "Wife"
    ],
    "tags": [
      "123av",
      "Japanese",
      "JAV",
      "Jav Porn"
    ],
    "actors": [
      "Yui Hatano"
    ],
    "studio": "JET映像",
    "code": "NGOD-272-UNCENSORED-LEAK",
    "views": 59997,
    "likes": 2045,
    "dislikes": 158,
    "is_hd": true,
    "player_api": "https://server.apijav.com/wp-json/myvideo/v1/player/83854",
    "embed_url": "https://server.apijav.com/?mvapm_embed=83854",
    "iframe_html": "<iframe src=\"https://server.apijav.com/?mvapm_embed=83854\" width=\"100%\" height=\"500\" frameborder=\"0\" allowfullscreen allow=\"autoplay; fullscreen; encrypted-media\" scrolling=\"no\"></iframe>"
  }
]

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const STORAGE_PREFIX = 'lumen_jav_v1_'

// In-memory cache for instantaneous lookup
const memoryCache = new Map<string, { result: JavCatalogResult; timestamp: number }>()

// In-flight request deduplication to prevent duplicate concurrent network calls
const inFlightRequests = new Map<string, Promise<JavCatalogResult>>()

export function getJavCacheKey(
  category = 'All',
  orderBy = 'views',
  page = 1,
  searchQuery = '',
  perPage = 24,
): string {
  return `${category.trim()}|${orderBy}|${page}|${perPage}|${searchQuery.trim().toLowerCase()}`
}

function readStorageCache(key: string): JavCatalogResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key) || window.sessionStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { result: JavCatalogResult; timestamp: number }
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.result?.posts) && parsed.result.posts.length > 0) {
      // Warm up memory cache from storage
      memoryCache.set(key, parsed)
      return parsed.result
    }
  } catch {}
  return null
}

function writeStorageCache(key: string, result: JavCatalogResult): void {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify({ result, timestamp: Date.now() })
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, payload)
    } catch {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, payload)
    }
  } catch {}
}

/**
 * Returns immediately cached catalog if available, or initial pre-warmed posts for default view.
 * Enables 0ms perceived latency on UI render.
 */
export function getCachedJavCatalog(params: {
  category?: string
  orderBy?: 'views' | 'date' | 'title'
  page?: number
  searchQuery?: string
  perPage?: number
}): JavCatalogResult | null {
  const { category = 'All', orderBy = 'views', page = 1, searchQuery = '', perPage = 24 } = params
  const key = getJavCacheKey(category, orderBy, page, searchQuery, perPage)

  // 1. Check in-memory cache (<0.1ms)
  const mem = memoryCache.get(key)
  if (mem && (Date.now() - mem.timestamp < CACHE_TTL_MS || mem.result.posts.length > 0)) {
    return mem.result
  }

  // 2. Check local/session storage (<1ms)
  const stored = readStorageCache(key)
  if (stored) {
    return stored
  }

  // 3. For the default catalog (page 1, All, views, no search), return pre-warmed seed posts
  if (page === 1 && (category === 'All' || !category) && orderBy === 'views' && !searchQuery.trim()) {
    const defaultResult: JavCatalogResult = {
      posts: INITIAL_JAV_POSTS,
      totalPosts: 12480,
      totalPages: 520,
    }
    memoryCache.set(key, { result: defaultResult, timestamp: Date.now() })
    return defaultResult
  }

  return null
}

/**
 * Fetches JAV catalog with multi-tier caching, deduplication, and fast response handling.
 */
export async function fetchJavCatalog(params: {
  category?: string
  orderBy?: 'views' | 'date' | 'title'
  page?: number
  searchQuery?: string
  perPage?: number
  signal?: AbortSignal
}): Promise<JavCatalogResult> {
  const { category = 'All', orderBy = 'views', page = 1, searchQuery = '', perPage = 24, signal } = params
  const key = getJavCacheKey(category, orderBy, page, searchQuery, perPage)

  // 1. Return cached if fresh (less than 15 mins old in memory)
  const mem = memoryCache.get(key)
  if (mem && Date.now() - mem.timestamp < 15 * 60 * 1000 && mem.result.posts.length > 0) {
    return mem.result
  }

  // 2. Return in-flight request if already pending (deduplication)
  const pending = inFlightRequests.get(key)
  if (pending) {
    return pending
  }

  // 3. Build API request
  const fetchPromise = (async () => {
    try {
      let url = `https://server.apijav.com/wp-json/myvideo/v1/posts?per_page=${perPage}&page=${page}&orderby=${orderBy}&order=DESC`
      if (category && category !== 'All') {
        url += `&category=${encodeURIComponent(category)}`
      }
      if (searchQuery && searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const onExternalAbort = () => controller.abort()
      if (signal) {
        signal.addEventListener('abort', onExternalAbort)
      }

      let res: Response
      try {
        res = await fetch(url, { signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
        if (signal) {
          signal.removeEventListener('abort', onExternalAbort)
        }
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const wpTotal = res.headers.get('X-WP-Total')
      const wpTotalPages = res.headers.get('X-WP-TotalPages')
      const totalPosts = wpTotal ? parseInt(wpTotal, 10) : 0
      const totalPages = wpTotalPages ? parseInt(wpTotalPages, 10) : 1

      const data: JavPost[] = await res.json()
      const posts = Array.isArray(data) ? data : []

      const result: JavCatalogResult = {
        posts,
        totalPosts: totalPosts || (posts.length > 0 ? posts.length * 20 : 0),
        totalPages: totalPages || 1,
      }

      // Cache result in memory and persistent storage
      memoryCache.set(key, { result, timestamp: Date.now() })
      writeStorageCache(key, result)

      // Preload top images for seamless rendering
      preloadJavImages(posts, 6)

      return result
    } catch (err) {
      // If error occurs, fallback to cached or seed if available
      const fallback = getCachedJavCatalog(params)
      if (fallback) {
        return fallback
      }
      throw err
    } finally {
      inFlightRequests.delete(key)
    }
  })()

  inFlightRequests.set(key, fetchPromise)
  return fetchPromise
}

/**
 * Prefetches default JAV catalog and preloads images in background.
 * Call when Lord profile is unlocked or tab is hovered.
 */
export function prefetchJavCatalog(): void {
  // Only prefetch in browser environment
  if (typeof window === 'undefined') return

  // Check if already in cache
  const cached = getCachedJavCatalog({ page: 1, category: 'All', orderBy: 'views' })
  if (cached && cached.posts.length > 0) {
    preloadJavImages(cached.posts, 6)
  }

  // Trigger network fetch in background to warm cache
  void fetchJavCatalog({ page: 1, category: 'All', orderBy: 'views' }).catch(() => {})
}

/**
 * Preloads top thumbnails in background to prevent image pop-in
 */
export function preloadJavImages(posts: JavPost[], limit = 6): void {
  if (typeof window === 'undefined') return
  posts.slice(0, limit).forEach((p) => {
    if (p.thumbnail) {
      try {
        const img = new Image()
        img.src = p.thumbnail
      } catch {}
    }
  })
}
