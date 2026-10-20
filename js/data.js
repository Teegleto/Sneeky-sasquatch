/* Sneeky Sasquatch - game data: items, fish, clothes, shop, quests */
'use strict';
(function () {
  // food = hunger restored, energy = energy restored, value = sell price at the store
  SS.ITEMS = {
    sandwich:   { name: 'Sandwich',     type: 'food', food: 22, energy: 0,  value: 2 },
    apple:      { name: 'Apple',        type: 'food', food: 9,  energy: 2,  value: 1 },
    hotdog:     { name: 'Hot Dog',      type: 'food', food: 18, energy: 0,  value: 2 },
    chips:      { name: 'Chips',        type: 'food', food: 10, energy: 2,  value: 1 },
    soda:       { name: 'Soda',         type: 'food', food: 4,  energy: 14, value: 1, drink: true },
    burger:     { name: 'Burger',       type: 'food', food: 28, energy: 0,  value: 3 },
    pie:        { name: 'Pie',          type: 'food', food: 35, energy: 4,  value: 4 },
    cake:       { name: 'Cake',         type: 'food', food: 40, energy: 8,  value: 6 },
    cookie:     { name: 'Cookie',       type: 'food', food: 8,  energy: 4,  value: 1 },
    cheese:     { name: 'Cheese',       type: 'food', food: 12, energy: 0,  value: 1 },
    watermelon: { name: 'Watermelon',   type: 'food', food: 30, energy: 4,  value: 3 },
    pizza:      { name: 'Pizza',        type: 'food', food: 30, energy: 0,  value: 3 },
    marshmallow:{ name: 'Marshmallows', type: 'food', food: 6,  energy: 6,  value: 1 },
    berries:    { name: 'Berries',      type: 'food', food: 6,  energy: 3,  value: 1 },
    mushroom:   { name: 'Mushroom',     type: 'food', food: 5,  energy: 0,  value: 2 },
    honey:      { name: 'Honey',        type: 'food', food: 14, energy: 22, value: 5 },
    coffee:     { name: 'Coffee',       type: 'food', food: 2,  energy: 32, value: 1, drink: true },
    leftovers:  { name: 'Leftovers',    type: 'food', food: 7,  energy: 0,  value: 0 },
    perch:      { name: 'Perch',        type: 'fish', food: 10, energy: 0, value: 6,  color: '#9bb85a' },
    trout:      { name: 'Trout',        type: 'fish', food: 12, energy: 0, value: 8,  color: '#c98ab0' },
    bass:       { name: 'Bass',         type: 'fish', food: 14, energy: 0, value: 10, color: '#5f8a4a' },
    catfish:    { name: 'Catfish',      type: 'fish', food: 16, energy: 0, value: 14, color: '#8a7a66' },
    pike:       { name: 'Pike',         type: 'fish', food: 18, energy: 0, value: 18, color: '#6f9a7a' },
    salmon:     { name: 'Salmon',       type: 'fish', food: 22, energy: 0, value: 22, color: '#e0806a' },
    golden:     { name: 'Golden Fish',  type: 'fish', food: 50, energy: 50, value: 120, color: '#f2c230' },
    stick:      { name: 'Stick',        type: 'misc', value: 0 },
    can:        { name: 'Empty Can',    type: 'misc', value: 1 }
  };
  SS.STACK = 9;

  // difficulty 0..1 for the reeling minigame
  SS.FISH = {
    perch: 0.22, trout: 0.38, bass: 0.48, catfish: 0.55, pike: 0.68, salmon: 0.74, golden: 0.93
  };
  SS.FISH_TABLES = {
    river: {
      day:   [['perch', 40], ['trout', 35], ['bass', 15], ['catfish', 5]],
      night: [['perch', 25], ['trout', 20], ['catfish', 45], ['bass', 10]]
    },
    lake: {
      day:   [['bass', 40], ['perch', 25], ['trout', 25], ['pike', 10], ['golden', 0.5]],
      night: [['bass', 30], ['catfish', 25], ['pike', 20], ['trout', 20], ['golden', 2]]
    },
    deep: {
      day:   [['pike', 30], ['salmon', 30], ['bass', 25], ['trout', 15], ['golden', 1.2]],
      night: [['salmon', 30], ['pike', 30], ['catfish', 20], ['bass', 10], ['golden', 7]]
    }
  };

  SS.LOOT = {
    basket: [['sandwich', 30], ['apple', 20], ['chips', 15], ['cookie', 12], ['cheese', 10], ['marshmallow', 8], ['pie', 5], ['watermelon', 4], ['cake', 2]],
    cooler: [['soda', 30], ['hotdog', 25], ['burger', 15], ['cheese', 10], ['watermelon', 8], ['pizza', 6], ['coffee', 6]],
    trash:  [['can', 50], ['leftovers', 30], ['chips', 8], ['apple', 6], ['pizza', 4]]
  };

  SS.HATS = {
    none:   { name: 'No Hat' },
    bucket: { name: 'Bucket Hat',   color: '#c9b47b' },
    cap:    { name: 'Baseball Cap', color: '#d23c3c', price: 20 },
    toque:  { name: 'Toque',        color: '#3a6fd8', price: 15 },
    cowboy: { name: 'Cowboy Hat',   color: '#8b5a2b', price: 35 },
    tophat: { name: 'Top Hat',      color: '#222228' }
  };
  SS.TOPS = {
    none:     { name: 'Just Fur' },
    plaid:    { name: 'Plaid Shirt',    color: '#c0392b', stripe: '#3a1c1c' },
    hoodie:   { name: 'Purple Hoodie',  color: '#7d5ba6', price: 30 },
    hawaiian: { name: 'Hawaiian Shirt', color: '#19a7a0', dots: '#f6d55c', price: 40 },
    polo:     { name: 'Golf Polo',      color: '#f4f4ee', stripe: '#3f8f4a' },
    tux:      { name: 'Tuxedo',         color: '#1d1d22', price: 120 }
  };

  // Things for sale at the General Store
  SS.SHOP = [
    { cat: 'Food', item: 'sandwich', price: 6 },
    { cat: 'Food', item: 'hotdog', price: 5 },
    { cat: 'Food', item: 'pizza', price: 12 },
    { cat: 'Food', item: 'pie', price: 12 },
    { cat: 'Food', item: 'cake', price: 25 },
    { cat: 'Food', item: 'coffee', price: 4 },
    { cat: 'Food', item: 'soda', price: 3 },
    { cat: 'Food', item: 'cookie', price: 3 },
    { cat: 'Gear', gear: 'rod', name: 'Fishing Rod', desc: 'Fish at the lake or river.', price: 40 },
    { cat: 'Gear', gear: 'prorod', name: 'Pro Fishing Rod', desc: 'Bigger catch zone, faster bites.', price: 150 },
    { cat: 'Gear', gear: 'bait', name: 'Bait x5', desc: 'Fish bite twice as fast.', price: 5 },
    { cat: 'Gear', gear: 'flashlight', name: 'Flashlight', desc: 'See in the dark (humans can see you too).', price: 30 },
    { cat: 'Gear', gear: 'bigpack', name: 'Huge Backpack', desc: '16 backpack slots.', price: 150 },
    { cat: 'Gear', gear: 'kart', name: 'Go-Kart', desc: 'Zoom around the park. Delivered to your cave.', price: 300 },
    { cat: 'Clothes', hat: 'toque', price: 15 },
    { cat: 'Clothes', hat: 'cap', price: 20 },
    { cat: 'Clothes', hat: 'cowboy', price: 35 },
    { cat: 'Clothes', top: 'hoodie', price: 30 },
    { cat: 'Clothes', top: 'hawaiian', price: 40 },
    { cat: 'Clothes', top: 'tux', price: 120 }
  ];

  // need: what the giver wants. reward: what you get.
  SS.QUESTS = [
    {
      id: 'sandwich', giver: 'raccoon', title: 'Snack Attack', requires: [],
      desc: 'Steal a Sandwich from a picnic basket at the campground and bring it to Raccoon.',
      need: { item: 'sandwich', n: 1 }, reward: { hat: 'bucket' },
      intro: [
        'Psst! Hey, big fella. Up here. Name\'s Raccoon. I run the snack business in these woods.',
        'You look hungry. Humans at Whispering Pines Campground leave picnic baskets and coolers lying around. Easy pickings!',
        'Just don\'t let them see you. They scream, then the Ranger comes running. If anyone spots you, dive into a bush.',
        'Bring me a Sandwich and I\'ll give you something that\'ll change your life.'
      ],
      waiting: 'A Sandwich, big guy. Picnic baskets at the campground. Sneak, grab, run!',
      done: [
        'A sandwich! You\'re a natural. Here, take this Bucket Hat. A camper "left it" by the lake.',
        'Humans don\'t scream at other humans. Get yourself a shirt too, and you\'ll blend right in.'
      ]
    },
    {
      id: 'shirt', giver: 'raccoon', title: 'Laundry Day', requires: ['sandwich'],
      desc: 'Take the Plaid Shirt off the clothesline at the south-east campsite, then show Raccoon.',
      need: { top: 'plaid' }, reward: { money: 15 },
      intro: [
        'A hat alone won\'t fool anyone. You need a shirt.',
        'There\'s a clothesline at the campsite on the south-east side of the loop. Someone hung a big Plaid Shirt out to dry.',
        'Swipe it and come back. Wear the hat AND the shirt (press C anytime) and humans will think you\'re one of them.'
      ],
      waiting: 'The Plaid Shirt is on the clothesline at the south-east campsite. Don\'t get caught!',
      done: [
        'Lookin\' sharp! Now listen: in disguise, people just think you\'re a really hairy camper.',
        'But if they see you STEAL something, the jig is up. Here\'s $15 I found in a tent. Humans trade this paper for food at the General Store in town.'
      ]
    },
    {
      id: 'pie', giver: 'raccoon', title: 'Sweet Tooth', requires: ['shirt'],
      desc: 'Wear your disguise and buy a Pie at the General Store in town (east, past the Ranger Station). Bring it to Raccoon.',
      need: { item: 'pie', n: 1 }, reward: { gear: 'rod' },
      intro: [
        'Time to try that disguise out. Head east past the Ranger Station to town and walk right into the General Store.',
        'Buy me a Pie. Blueberry, cherry, I\'m not picky. Short on cash? The recycling machine outside the store pays for empty cans.'
      ],
      waiting: 'Pie! General Store, east side of the park. Wear your hat and shirt or the shopkeeper will flip out.',
      done: [
        'Mmmm, pie. You\'ve earned this: my old Fishing Rod.',
        'Stand by the lake or the river and press E to cast. Fish sell for good money at the store, and Bear by the river has been craving some.'
      ]
    },
    {
      id: 'fish', giver: 'bear', title: 'Bear Necessities', requires: ['pie'],
      desc: 'Catch 3 fish (any kind) and bring them to Bear by the river, west of the campground.',
      need: { fish: 3 }, reward: { items: [['honey', 3]], slots: 12 },
      intro: [
        'Hrrmm. A sasquatch with a fishing rod. Now I\'ve seen everything.',
        'My paws aren\'t what they used to be. Bring me 3 fish, any kind, and I\'ll make it worth your while.'
      ],
      waiting: 'Three fish. The river\'s right there. Hrrmm.',
      done: [
        'Delicious. Take some honey, it\'ll keep your energy up. And this old backpack a hiker dropped. Holds way more stuff.',
        'A tip: the Ranger dozes off at his station every night after 1 AM. Snores like a chainsaw.'
      ]
    },
    {
      id: 'sticks', giver: 'beaver', title: 'Dam Good Work', requires: [],
      desc: 'Collect 6 Sticks in the forest and bring them to Beaver by the broken bridge.',
      need: { item: 'stick', n: 6 }, reward: { flag: 'bridge' },
      intro: [
        'Oh! Oh! Hello! I\'m Beaver! Have you seen the bridge? A storm knocked it to bits!',
        'The golf course is on the other side and the humans there have the BEST snacks.',
        'If you bring me 6 Sticks from the forest, I\'ll fix it up good as new. Better, even!'
      ],
      waiting: 'Six sticks! They\'re lying around the forest floor. Look for little brown twigs!',
      done: [
        'Chomp chomp chomp... TA-DA! The bridge is fixed! Go see the golf course!',
        'I heard the clubhouse runs a Golf Challenge. Prize money and everything!'
      ]
    },
    {
      id: 'golf', giver: 'golf', title: 'Fore!', requires: ['sticks'],
      desc: 'Win the Golf Challenge at the clubhouse south of the river: finish 3 holes at or under par.',
      need: { flag: 'golfWon' }, reward: { money: 100, top: 'polo' }
    },
    {
      id: 'kart', giver: 'raccoon', title: 'Need for Speed', requires: ['pie'],
      desc: 'Bring Raccoon a Cake. The General Store sells them, and they sometimes turn up in picnic baskets.',
      need: { item: 'cake', n: 1 }, reward: { gear: 'kart' },
      intro: [
        'I found something AMAZING behind the Ranger Station. A go-kart! The keys were in it and everything.',
        'It\'s too big for me, but it\'d fit you. I\'ll trade you the keys for a Cake. A whole one.'
      ],
      waiting: 'One Cake, one go-kart. The store has \'em. Deal\'s a deal.',
      done: [
        'Cake! Deal. The go-kart is parked by your cave. Press E next to it to drive.',
        'Humans in cars don\'t look twice at other cars. But a sasquatch driving? Wear the disguise.'
      ]
    },
    {
      id: 'heist', giver: 'raccoon', title: 'The Great Cake Heist', requires: ['kart'],
      desc: 'Steal the giant Birthday Cake from the party at the Ranger Station and carry it back to Raccoon.',
      need: { carry: 'giantcake' }, reward: { ending: true },
      intro: [
        'Big news. It\'s the Ranger\'s birthday. There\'s a GIANT cake on a table outside the Ranger Station.',
        'This is it. The big one. Grab that cake and carry it back here. It\'s heavy, so you\'ll be slow, and you can\'t run.',
        'Make some noise to lure people away. Rummaging in trash cans is noisy. Or wait until the Ranger nods off late at night...',
        'And park your go-kart nearby. Nobody can catch a sasquatch in a go-kart!'
      ],
      waiting: 'The Giant Cake is outside the Ranger Station. Lure the guards away with a noisy trash can, or come back after 1 AM.',
      done: [
        'YOU DID IT! The Great Cake Heist! They\'ll be telling this story around campfires for years!',
        'Grab a fork, big guy. Every critter in the forest is invited.'
      ]
    },
    {
      id: 'golden', giver: 'bear', title: 'Golden Catch', requires: ['fish'],
      desc: 'Catch the legendary Golden Fish. It bites best at night, far out on the lake (take the rowboat at the dock).',
      need: { item: 'golden', n: 1 }, reward: { money: 200, hat: 'tophat' },
      intro: [
        'Hrrmm. They say there\'s a Golden Fish in the lake. Glitters like the sun.',
        'Only bites at night, way out where the water\'s deep. Take the rowboat at the dock. Bring it to me and I\'ll give you my lucky hat.'
      ],
      waiting: 'Golden Fish. Night time. Deep water, way out on the lake. Hrrmm.',
      done: [
        'By my fur, it\'s real! Here: $200 from my secret stash, and my fancy Top Hat. Very dapper.'
      ]
    }
  ];

  SS.SCREAMS = ['AAAH! BIGFOOT!', 'SASQUATCH!!', 'RANGER! HELP!', 'IT\'S REAL!!', 'EEEK!', 'MONSTER!'];
  SS.THIEF = ['Hey! Thief!', 'That\'s my lunch!', 'Stop! Thief!', 'Ranger! He took my food!'];
  SS.HUH = ['Huh?', 'What was that?', 'Hello?', 'Is someone there?'];

  SS.SIGNS = {
    camp: 'WHISPERING PINES CAMPGROUND. Please do not feed the wildlife.',
    lake: 'MIRROR LAKE. Dock and rowboat ahead. Fishing permitted.',
    town: 'TOWN: General Store, open 7 AM to 10 PM.',
    bridge: 'BRIDGE OUT. Golf Course closed until repairs are complete.',
    golf: 'PINECONE GOLF CLUB. Golf Challenge: $10. Finish at or under par to win!',
    station: 'RANGER STATION. Report all sasquatch sightings.',
    cave: 'KEEP OUT. (Signed, the Sasquatch)'
  };
})();
