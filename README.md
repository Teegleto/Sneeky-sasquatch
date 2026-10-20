# Sneeky Sasquatch

A cozy stealth-adventure game for the browser, inspired by *Sneaky Sasquatch*. You're a hungry
sasquatch living in a cave next to Whispering Pines Campground. Sneak around, raid picnic baskets,
hide in bushes, dodge the park ranger, put on a disguise, go shopping, fish, golf, and pull off the
Great Cake Heist.

Everything is plain HTML5 Canvas and JavaScript, with no build step, frameworks or image files.
All the art and sound is generated in code.

## Play

- **Easiest:** open `index.html` in any modern browser (double-clicking it works).
- **Local server:** `npx serve .` (or any static server), then open the printed URL.
- **One file:** `node tools/build-single-file.js` writes `dist/sneeky-sasquatch.html`, a single
  self-contained file you can share or host anywhere.
- **GitHub Pages:** enable Pages for this repository (Settings → Pages → deploy from the default
  branch, root folder) and the game will be served at your Pages URL.

Progress is saved in your browser every time you sleep in your cave (and from the pause menu).

## Controls

| Action | Keyboard | Phone / tablet |
| --- | --- | --- |
| Move | WASD or arrow keys | Drag on the left side of the screen |
| Run (uses energy) | Shift | Hold the runner button |
| Interact, grab, talk, fish, reel | E or Space | Hand button |
| Select / eat an item | 1–9, then F (or click an item) | Backpack button |
| Wardrobe | C | Shirt button |
| Map / Quests | M / J | Map and list buttons |
| Pause menu | Esc | Menu button |
| Golf | Drag back and release, or A/D aim, W/S power, Space swing, C club | Drag back and release |

## What's in the game

- **Stealth.** Campers, townsfolk, beachgoers and golfers have vision cones. A filling **?** means
  someone is getting suspicious; a full one means they scream "BIGFOOT!" and call the ranger. Walls,
  tents, cars and tree trunks block line of sight, and nobody can see you inside a bush.
- **The Ranger.** He patrols the campground, beach and station, runs to reports, chases you when he
  sees you, searches where he lost you, and checks out noises. If he catches you, he drags you back
  to your cave and confiscates your backpack. He patrols with a flashlight at night, but he naps at
  his station after 1 AM.
- **Survival.** Hunger and energy drain over time (faster when running). Eat what you steal, buy or
  forage, and sleep in your cave at night. A full day lasts about 10 minutes.
- **Day and night.** Campers sit by their campfires in the evening and sleep in their tents at night.
  Lamps, windows and fires light up the dark.
- **Disguises.** Wear a hat *and* a shirt and humans think you're a (very hairy) camper. You can walk
  into the General Store and the Golf Clubhouse. If someone sees you steal, your cover is blown for a
  while. Changing clothes out of sight resets it.
- **Things to steal:** picnic baskets, coolers, noisy trash cans, a clothesline, and a giant birthday cake.
- **Foraging:** berries, mushrooms, sticks and empty cans (recycle them for cash outside the store).
- **The General Store:** buy food, clothes, fishing gear, bait, a flashlight, a bigger backpack or a
  go-kart, and sell fish and forage.
- **Fishing:** cast from the shore, the dock or the rowboat. Hook the fish when the bobber dips, then
  keep it in the green zone to reel it in. There are 7 species; deep water and night fishing have
  rarer catches, including the legendary Golden Fish.
- **Golf:** a 3-hole golf challenge with driving and putting, sand traps, trees, water hazards and a
  scorecard. Beat par for prize money.
- **Vehicles:** go-kart, golf cart and rowboat.
- **Quests:** 9 quests from Raccoon, Bear, Beaver and the Golf Pro, ending with the Great Cake Heist.
- **Cave:** sleep (saves the game), a 30-slot stash for things you can't afford to lose, and a wardrobe.

## Project layout

```
index.html              page shell and HUD markup
css/style.css           UI styling
js/core.js              math helpers, seeded random, input (keyboard, mouse, touch), procedural audio
js/data.js              items, fish, loot tables, clothes, shop, quests and dialogue
js/world.js             map layout, terrain, colliders, line of sight, A* pathfinding
js/render.js            procedural art: ground, objects, characters, vehicles, icons, lighting
js/entities.js          player, humans and their vision/suspicion AI, the ranger, vehicles
js/minigames.js         fishing and golf
js/ui.js                HUD, hotbar, dialogue, shop, cave, wardrobe, map, quest log, menus
js/game.js              game loop, camera, time of day, interactions, quests, rendering, saving
tools/build-single-file.js   bundles everything into one HTML file
```

## About

This is an original, fan-made game inspired by the gameplay of *Sneaky Sasquatch* by RAC7 Games.
It is not affiliated with or endorsed by RAC7 or Apple. All code, art, characters, text and audio
here were created for this project.
