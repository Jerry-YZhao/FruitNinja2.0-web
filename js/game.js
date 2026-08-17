// Port of FruitNinja2.0/game.py — original screens, assets, and rules.

const ASSET = (file) => "assets/" + file;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const stage = document.getElementById("stage");
const fit = document.getElementById("fit");
const fitOuter = document.getElementById("fit-outer");

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

const imageCache = {};
const audioBuffers = {};

let audioCtx = null;
let currentMusic = null;
let introStarted = false;
let audioReady = false;
let audioPromise = null;

let screen_width = 0;
let screen_height = 0;
let stageW = 0;
let stageH = 0;

let nextId = 1;
let items = new Map();

let player_name = "";
let bg_image_choice = 1;
let laser_choice = 1;
let bg_image = null;

let hold = false;
let game = true;
let win = false;
let score = 0;
let lives = 3;

let heart_list = [];
let fruits_list = [];
let bomb_list = [];
let explosion_list = [
  "explosion_1.gif",
  "explosion_2.gif",
  "explosion_3.gif",
  "explosion_4.gif",
  "explosion_5.gif",
  "explosion_6.gif",
  "explosion_7.gif",
];
let explosion_giflist = [];
let explosion_finished = [];
let red_laser_list = ["laser_red_1.png", "laser_red_2.png", "laser_red_3.png", "laser_red_4.png"];
let yellow_laser_list = ["laser_yellow_1.png", "laser_yellow_2.png", "laser_yellow_3.png", "laser_yellow_4.png"];
let blue_laser_list = ["laser_blue_1.png", "laser_blue_2.png", "laser_blue_3.png", "laser_blue_4.png"];
let laser_giflist = [];
let laser_finished = [];

const x_positions_dic = { 1: 160, 2: 287.5, 3: 462.5, 4: 637.5 };

const fruit_dic = {
  1: "watermelon.png",
  2: "apple.png",
  3: "pear.png",
  4: "blueberry.png",
  5: "banana.png",
  6: "cherry.png",
  7: "mango.png",
  8: "lemon.png",
};

const splash_dic = {
  1: "yellow_splash.png",
  2: "red_splash.png",
  3: "green_splash.png",
  4: "blue_splash.png",
};

let fruitCreateTimer = null;
let bombCreateTimer = null;
let fruitMoveTimer = null;
let bombMoveTimer = null;
let laserGeneration = 0;
let gameplayActive = false;
let ending = false;
let score_display = 0;
let count3 = 0;
let count2 = 0;
let count1 = 0;
let bomb_image = null;
let heart_image = null;

const SFX_FILES = [
  "intro.wav",
  "game_sound.wav",
  "choose_sound.wav",
  "laser_shot.wav",
  "bomb_sound.wav",
  "win_quick.wav",
  "lost_quick.wav",
  "win_canvas.wav",
  "loose_canvas.wav",
  "tick.wav",
];

function randint(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadImage(file) {
  if (imageCache[file]) {
    return Promise.resolve(imageCache[file]);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache[file] = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = ASSET(file);
  });
}

async function ensureAudio() {
  if (!audioPromise) {
    audioPromise = (async () => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      await Promise.all(
        SFX_FILES.map(async (file) => {
          const res = await fetch(ASSET(file));
          const buf = await res.arrayBuffer();
          audioBuffers[file] = await audioCtx.decodeAudioData(buf.slice(0));
        })
      );
      audioReady = true;
    })();
  }
  await audioPromise;
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

function playSfx(file) {
  if (!audioCtx || !audioBuffers[file]) return;
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffers[file];
  src.connect(audioCtx.destination);
  src.start();
}

function stopMusic() {
  if (currentMusic) {
    try {
      currentMusic.stop();
    } catch (e) {
      /* already stopped */
    }
    currentMusic = null;
  }
}

function playMusic(file, loop) {
  stopMusic();
  if (!audioCtx || !audioBuffers[file]) return;
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffers[file];
  src.loop = !!loop;
  src.connect(audioCtx.destination);
  src.start();
  currentMusic = src;
}

async function startIntroMusic() {
  await ensureAudio();
  if (audioCtx.state === "suspended") return;
  if (introStarted) return;
  introStarted = true;
  playMusic("intro.wav", false);
}

function setCursor(kind) {
  document.body.classList.remove("cursor-tcross", "cursor-target");
  document.body.classList.add(kind === "target" ? "cursor-target" : "cursor-tcross");
}

function applyFit(w, h) {
  stageW = w;
  stageH = h;
  const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
  fitOuter.style.width = w * scale + "px";
  fitOuter.style.height = h * scale + "px";
  fit.style.width = w + "px";
  fit.style.height = h + "px";
  fit.style.transform = "scale(" + scale + ")";
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}

function clearOverlay() {
  overlay.innerHTML = "";
}

function clearItems() {
  items = new Map();
  nextId = 1;
}

function createImageItem(x, y, image, anchor, destW, destH) {
  const id = nextId++;
  items.set(id, {
    type: "image",
    x,
    y,
    image,
    anchor: anchor || "center",
    destW: destW == null ? image.width : destW,
    destH: destH == null ? image.height : destH,
    hidden: false,
  });
  return id;
}

function createTextItem(x, y, text, size, fill, anchor) {
  const id = nextId++;
  items.set(id, {
    type: "text",
    x,
    y,
    text,
    size,
    fill,
    anchor: anchor || "center",
    hidden: false,
  });
  return id;
}

function deleteItem(id) {
  items.delete(id);
}

function moveItem(id, dx, dy) {
  const item = items.get(id);
  if (!item) return;
  item.x += dx;
  item.y += dy;
}

function coords(id) {
  const item = items.get(id);
  if (!item) return [0, 0];
  return [item.x, item.y];
}

function itemconfigure(id, props) {
  const item = items.get(id);
  if (!item) return;
  if (props.text !== undefined) item.text = props.text;
  if (props.hidden !== undefined) item.hidden = props.hidden;
}

function drawItem(item) {
  if (item.hidden) return;
  if (item.type === "image") {
    const w = item.destW;
    const h = item.destH;
    let dx = item.x;
    let dy = item.y;
    if (item.anchor === "nw") {
      dx = item.x;
      dy = item.y;
    } else if (item.anchor === "ne") {
      dx = item.x - w;
      dy = item.y;
    } else {
      dx = item.x - w / 2;
      dy = item.y - h / 2;
    }
    ctx.drawImage(item.image, dx, dy, w, h);
  } else if (item.type === "text") {
    const lines = String(item.text).split("\n");
    ctx.font = item.size + "px Rockwell, serif";
    ctx.fillStyle = item.fill;
    const lineHeight = item.size * 1.2;
    if (item.anchor === "nw") {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      lines.forEach((line, i) => {
        ctx.fillText(line, item.x, item.y + i * lineHeight);
      });
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const totalHeight = lineHeight * lines.length;
      const startY = item.y - totalHeight / 2 + lineHeight / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, item.x, startY + i * lineHeight);
      });
    }
  }
}

function render() {
  ctx.fillStyle = canvas._bg || "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  items.forEach((item) => drawItem(item));
}

function setCanvasBg(color) {
  canvas._bg = color;
}

function addImageButton(src, x, y, w, h, onClick) {
  const btn = document.createElement("button");
  btn.className = "img-btn";
  btn.style.left = x + "px";
  btn.style.top = y + "px";
  btn.style.width = w + "px";
  btn.style.height = h + "px";
  const img = document.createElement("img");
  img.src = ASSET(src);
  btn.appendChild(img);
  btn.addEventListener("click", onClick);
  overlay.appendChild(btn);
  return btn;
}

function addTextButton(label, x, y, onClick) {
  const btn = document.createElement("button");
  btn.className = "text-btn";
  btn.textContent = label;
  btn.style.left = x + "px";
  btn.style.top = y + "px";
  btn.addEventListener("click", onClick);
  overlay.appendChild(btn);
  return btn;
}

function addNameEntry(x, y, w, h) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "name-entry";
  input.style.left = x + "px";
  input.style.top = y + "px";
  input.style.width = w + "px";
  input.style.height = h + "px";
  overlay.appendChild(input);
  return input;
}

function resetRunState() {
  hold = false;
  game = true;
  win = false;
  score = 0;
  lives = 3;
  heart_list = [];
  fruits_list = [];
  bomb_list = [];
  explosion_giflist = [];
  explosion_finished = [];
  laser_giflist = [];
  laser_finished = [];
  ending = false;
  gameplayActive = false;
  laserGeneration += 1;
  clearGameplayTimers();
}

function clearGameplayTimers() {
  clearTimeout(fruitCreateTimer);
  clearTimeout(bombCreateTimer);
  clearTimeout(fruitMoveTimer);
  clearTimeout(bombMoveTimer);
  fruitCreateTimer = null;
  bombCreateTimer = null;
  fruitMoveTimer = null;
  bombMoveTimer = null;
}

function unbindLaser() {
  canvas.removeEventListener("pointerdown", onLaserDown);
  window.removeEventListener("pointerup", onLaserUp);
}

// destroy after getting player's name input
function getName() {
  playSfx("choose_sound.wav");
  showBgChoose();
}

function bgFgyy() {
  playSfx("choose_sound.wav");
  bg_image_choice = 1;
  showLaserChoose();
}

function bgTzl() {
  playSfx("choose_sound.wav");
  bg_image_choice = 2;
  showLaserChoose();
}

function bgWqsy() {
  playSfx("choose_sound.wav");
  bg_image_choice = 3;
  showLaserChoose();
}

function redLaser() {
  playSfx("choose_sound.wav");
  laser_choice = 1;
  showInstructions();
}

function blueLaser() {
  playSfx("choose_sound.wav");
  laser_choice = 2;
  showInstructions();
}

function yellowLaser() {
  playSfx("choose_sound.wav");
  laser_choice = 3;
  showInstructions();
}

function gotIt() {
  playSfx("choose_sound.wav");
  showGameplay();
}

async function startCountdown() {
  playSfx("tick.wav");
  for (let a = 0; a < 60; a++) {
    itemconfigure(count3, { hidden: false });
    render();
    await sleep(10);
  }
  playSfx("tick.wav");
  for (let b = 0; b < 60; b++) {
    itemconfigure(count3, { hidden: true });
    itemconfigure(count2, { hidden: false });
    render();
    await sleep(10);
  }
  playSfx("tick.wav");
  for (let c = 0; c < 60; c++) {
    itemconfigure(count2, { hidden: true });
    itemconfigure(count1, { hidden: false });
    render();
    await sleep(10);
  }
  deleteItem(count3);
  deleteItem(count2);
  deleteItem(count1);
  render();
}

function createFruits() {
  if (game === true) {
    const which_fruit = randint(1, 8);
    const this_fruit = imageCache[fruit_dic[which_fruit]];
    const choose_position = randint(1, 4);
    const x_position = x_positions_dic[choose_position];
    const my_photo = createImageItem(x_position, 0, this_fruit);
    fruits_list.push([my_photo, randint(8, 15), this_fruit]);
    fruitCreateTimer = setTimeout(createFruits, 250);
  }
}

function createBombs() {
  if (game === true) {
    const choose_position = randint(1, 4);
    const x_position = x_positions_dic[choose_position];
    const bomb_photo = createImageItem(x_position, 0, bomb_image);
    bomb_list.push([bomb_photo, randint(8, 15), bomb_image]);
    bombCreateTimer = setTimeout(createBombs, 1500);
  }
}

async function moveFruits() {
  if (!gameplayActive || ending) return;
  for (let i = 0; i < fruits_list.length; i++) {
    const fruit = fruits_list[i];
    if (!items.has(fruit[0])) continue;
    moveItem(fruit[0], 0, fruit[1]);
    const y = coords(fruit[0])[1];
    if (y >= 550 && y <= 650 && hold === true) {
      deleteItem(fruit[0]);
      fruits_list.splice(i, 1);
      score += 1;
      itemconfigure(score_display, { text: String(score) });
      const splash_prob = randint(1, 10);
      if (splash_prob === 1) {
        const which_splash = randint(1, 4);
        const this_splash = imageCache[splash_dic[which_splash]];
        const splash_x = randint(0, 800);
        const splash_y = randint(200, 1000);
        createImageItem(splash_x, splash_y, this_splash);
      } else if (score === 100) {
        if (ending) return;
        ending = true;
        hold = false;
        game = false;
        gameplayActive = false;
        clearGameplayTimers();
        stopMusic();
        playSfx("win_quick.wav");
        clearItems();
        createImageItem(0, 0, bg_image, "nw");
        createTextItem(400, 600, "GAME OVER!", 50, "white");
        render();
        await sleep(3000);
        win = true;
        showReport();
        return;
      }
    } else if (y >= 1300) {
      deleteItem(fruit[0]);
      fruits_list.splice(i, 1);
    }
  }
  if (!gameplayActive || ending) return;
  render();
  fruitMoveTimer = setTimeout(moveFruits, 10);
}

async function moveBombs() {
  if (!gameplayActive || ending) return;
  for (let i = 0; i < bomb_list.length; i++) {
    const bomb = bomb_list[i];
    if (!items.has(bomb[0])) continue;
    moveItem(bomb[0], 0, bomb[1]);
    const y = coords(bomb[0])[1];
    if (y >= 550 && y <= 650 && hold === true) {
      playSfx("bomb_sound.wav");
      lives -= 1;
      const bx = coords(bomb[0])[0];
      for (const gif of explosion_giflist) {
        if (ending) return;
        const explosion_photo = createImageItem(bx, 600, gif);
        render();
        await sleep(50);
        explosion_finished.push(explosion_photo);
        deleteItem(explosion_finished[0]);
        explosion_finished.splice(0, 1);
      }
      if (ending) return;
      deleteItem(bomb[0]);
      bomb_list.splice(i, 1);
      if (heart_list.length > 1) {
        deleteItem(heart_list[0]);
        heart_list.splice(0, 1);
      } else {
        if (ending) return;
        ending = true;
        hold = false;
        game = false;
        gameplayActive = false;
        clearGameplayTimers();
        stopMusic();
        if (heart_list.length > 0) {
          deleteItem(heart_list[0]);
          heart_list.splice(0, 1);
        }
        playSfx("lost_quick.wav");
        clearItems();
        createImageItem(0, 0, bg_image, "nw");
        createTextItem(400, 600, "GAME OVER!", 50, "white");
        render();
        await sleep(4000);
        win = false;
        showReport();
        return;
      }
    } else if (y >= 1300) {
      deleteItem(bomb[0]);
      bomb_list.splice(i, 1);
    }
  }
  if (!gameplayActive || ending) return;
  render();
  bombMoveTimer = setTimeout(moveBombs, 10);
}

async function laser() {
  hold = true;
  playSfx("laser_shot.wav");
  const gen = laserGeneration;
  for (let k = 0; k < 1000; k++) {
    for (const gif of laser_giflist) {
      if (gen !== laserGeneration || !gameplayActive) return;
      const laser_photo = createImageItem(400, 600, gif);
      render();
      await sleep(10);
      laser_finished.push(laser_photo);
      deleteItem(laser_finished[0]);
      laser_finished.splice(0, 1);
      if (hold === false) {
        return;
      }
    }
  }
  if (hold && gameplayActive && gen === laserGeneration) {
    setTimeout(laser, 10);
  }
}

function cancelLaser() {
  hold = false;
}

function onLaserDown(event) {
  if (!gameplayActive || game !== true) return;
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  laser();
}

function onLaserUp(event) {
  if (event.button !== undefined && event.button !== 0) return;
  cancelLaser();
}

function againYes() {
  playSfx("choose_sound.wav");
  startRun();
}

function againNo() {
  playSfx("choose_sound.wav");
  stopMusic();
  unbindLaser();
  clearGameplayTimers();
  gameplayActive = false;
  clearOverlay();
  clearItems();
  setCanvasBg("#000");
  applyFit(800, 1200);
  render();
}

async function showIntro() {
  setCursor("tcross");
  unbindLaser();
  clearOverlay();
  clearItems();
  setCanvasBg("#000");
  applyFit(screen_width, screen_height);
  const first_canvas = await loadImage("first_bg.png");
  createImageItem(0, 0, first_canvas, "nw", screen_width, screen_height);
  createTextItem(screen_width / 2, screen_height * 0.8, "Please Enter Your Name Here:", 15, "white");
  render();
  const nameEntry = addNameEntry(screen_width / 2, screen_height * 0.85, screen_width / 3, screen_height * 0.05);
  addImageButton("go_button.png", screen_width / 2, screen_height * 0.95, screen_width / 10, screen_width / 10, () => {
    player_name = nameEntry.value;
    getName();
  });
}

async function showBgChoose() {
  setCursor("tcross");
  clearOverlay();
  clearItems();
  setCanvasBg("#fff");
  applyFit(screen_width, screen_height);
  const second_canvas = await loadImage("second_canvas.png");
  createImageItem(0, 0, second_canvas, "nw", screen_width, screen_height);
  createTextItem(screen_width / 2, screen_height * 0.1, "Choose Your Background!", 20, "white");
  render();
  const side = screen_width / 3;
  addImageButton("fgyy_square.png", screen_width / 2, screen_height / 4, side, side, bgFgyy);
  addImageButton("tzl_square.png", screen_width / 2, screen_height / 2, side, side, bgTzl);
  addImageButton("wqsy_square.png", screen_width / 2, screen_height * 0.75, side, side, bgWqsy);
}

async function showLaserChoose() {
  setCursor("tcross");
  clearOverlay();
  clearItems();
  setCanvasBg("#fff");
  applyFit(screen_width, screen_height);
  const third_canvas = await loadImage("third_canvas.png");
  createImageItem(0, 0, third_canvas, "nw", screen_width, screen_height);
  createTextItem(screen_width / 2, screen_height * 0.1, "Choose Your Laser!", 20, "white");
  render();
  const side = screen_width / 3;
  addImageButton("red_square.png", screen_width / 2, screen_height / 4, side, side, redLaser);
  addImageButton("blue_square.png", screen_width / 2, screen_height / 2, side, side, blueLaser);
  addImageButton("yellow_square.png", screen_width / 2, screen_height * 0.75, side, side, yellowLaser);
}

async function showInstructions() {
  setCursor("tcross");
  clearOverlay();
  clearItems();
  setCanvasBg("#000");
  applyFit(screen_width, screen_height);
  const ins_bg = await loadImage("ins_bg.png");
  createImageItem(0, 0, ins_bg, "nw", screen_width, screen_height);
  createTextItem(screen_width / 3, screen_height * 0.1, "Instruction:", 20, "white");
  createTextItem(
    screen_width / 2,
    screen_height * 0.5,
    "1. Hold left mouse button to trigger the \n\n    laser, release it to stop the laser\n\n\n2. Your goal is to get as many fruits as\n\n    possible, but to avoid those annoying\n\n    bombs. Whenever your laser cuts a fruit,\n\n    you will gain one point. The score is\n\n    shown on the top left corner.\n\n    You will win if your score reaches 100\n\n\n3. Remember! You only have three lives,\n\n    everytime you explode a bomb,\n\n    your will loose one life, until none \n\n    of them left\n\n\n4. Enjoy and have FUN!",
    9,
    "white"
  );
  render();
  addTextButton("GOT IT! -->", screen_width * 0.73, screen_height * 0.9, gotIt);
}

async function showGameplay() {
  stopMusic();
  setCursor("target");
  clearOverlay();
  clearItems();
  setCanvasBg("#000");
  applyFit(800, 1200);

  bomb_image = await loadImage("bomb.png");
  heart_image = await loadImage("heart.png");

  explosion_giflist = [];
  for (const image_file of explosion_list) {
    explosion_giflist.push(await loadImage(image_file));
  }

  if (bg_image_choice === 1) {
    bg_image = await loadImage("fgyy_canvas.png");
  } else if (bg_image_choice === 2) {
    bg_image = await loadImage("tzl_canvas.png");
  } else if (bg_image_choice === 3) {
    bg_image = await loadImage("wqsy_canvas.png");
  }
  createImageItem(0, 0, bg_image, "nw");

  let laser_list;
  if (laser_choice === 1) {
    laser_list = red_laser_list;
    const red_gun = await loadImage("red_gun.png");
    const red_gun2 = await loadImage("red_gun2.png");
    createImageItem(100, 600, red_gun);
    createImageItem(700, 600, red_gun2);
  } else if (laser_choice === 2) {
    laser_list = blue_laser_list;
    const blue_gun = await loadImage("blue_gun.png");
    const blue_gun2 = await loadImage("blue_gun2.png");
    createImageItem(100, 600, blue_gun);
    createImageItem(700, 600, blue_gun2);
  } else {
    laser_list = yellow_laser_list;
    const yellow_gun = await loadImage("yellow_gun.png");
    const yellow_gun2 = await loadImage("yellow_gun2.png");
    createImageItem(100, 600, yellow_gun);
    createImageItem(700, 600, yellow_gun2);
  }

  laser_giflist = [];
  for (const imagefile of laser_list) {
    laser_giflist.push(await loadImage(imagefile));
  }

  createTextItem(0, 0, "Score:", 40, "white", "nw");
  score_display = createTextItem(100, 150, score, 40, "white");

  count3 = createTextItem(400, 600, "3", 100, "white");
  itemconfigure(count3, { hidden: true });
  count2 = createTextItem(400, 600, "2", 100, "white");
  itemconfigure(count2, { hidden: true });
  count1 = createTextItem(400, 600, "1", 100, "white");
  itemconfigure(count1, { hidden: true });

  const heart1 = createImageItem(800, 150, heart_image, "ne");
  heart_list.push(heart1);
  const heart2 = createImageItem(800, 75, heart_image, "ne");
  heart_list.push(heart2);
  const heart3 = createImageItem(800, 0, heart_image, "ne");
  heart_list.push(heart3);

  render();

  await startCountdown();

  playMusic("game_sound.wav", true);

  gameplayActive = true;
  createFruits();
  createBombs();
  moveFruits();
  moveBombs();

  canvas.addEventListener("pointerdown", onLaserDown);
  window.addEventListener("pointerup", onLaserUp);
}

async function showReport() {
  gameplayActive = false;
  unbindLaser();
  clearGameplayTimers();
  laserGeneration += 1;
  hold = false;
  setCursor("tcross");
  clearOverlay();
  clearItems();
  setCanvasBg("#000");
  applyFit(800, 1200);

  const report_screen_bg = await loadImage("report_screen_bg.png");
  createImageItem(0, 0, report_screen_bg, "nw");

  if (win === true) {
    playSfx("win_canvas.wav");
    const heart = await loadImage("heart.png");
    createTextItem(400, 300, "YOU WON,", 40, "white");
    createTextItem(400, 420, player_name + "!", 60, "white");
    createTextItem(400, 600, "You Have " + String(lives) + " Live(s) Left!", 30, "white");
    if (lives === 3) {
      createImageItem(400, 700, heart);
      createImageItem(320, 700, heart);
      createImageItem(475, 700, heart);
    } else if (lives === 2) {
      createImageItem(350, 700, heart);
      createImageItem(450, 700, heart);
    } else if (lives === 1) {
      createImageItem(400, 700, heart);
    }
  } else {
    playSfx("loose_canvas.wav");
    createTextItem(400, 300, "YOU LOST,", 40, "white");
    createTextItem(400, 420, player_name + "!", 60, "white");
    createTextItem(400, 630, "You Scored " + String(score) + " Points!", 30, "white");
  }

  createTextItem(400, 800, "Do You Want to Play Again?", 25, "white");
  render();
  addImageButton("yes.png", 300, 1000, 100, 100, againYes);
  addImageButton("no.png", 500, 1000, 100, 100, againNo);
}

async function startRun() {
  screen_width = Math.floor(window.innerWidth / 4);
  screen_height = Math.floor(window.innerHeight / 1.5);
  if (screen_width < 1) screen_width = 1;
  if (screen_height < 1) screen_height = 1;
  resetRunState();
  introStarted = false;
  await startIntroMusic();
  await showIntro();
}

async function preloadGameplayAssets() {
  const files = [
    "first_bg.png",
    "go_button.png",
    "second_canvas.png",
    "fgyy_square.png",
    "tzl_square.png",
    "wqsy_square.png",
    "third_canvas.png",
    "red_square.png",
    "blue_square.png",
    "yellow_square.png",
    "ins_bg.png",
    "bomb.png",
    "heart.png",
    "fgyy_canvas.png",
    "tzl_canvas.png",
    "wqsy_canvas.png",
    "red_gun.png",
    "red_gun2.png",
    "blue_gun.png",
    "blue_gun2.png",
    "yellow_gun.png",
    "yellow_gun2.png",
    "report_screen_bg.png",
    "yes.png",
    "no.png",
    ...explosion_list,
    ...red_laser_list,
    ...blue_laser_list,
    ...yellow_laser_list,
    ...Object.values(fruit_dic),
    ...Object.values(splash_dic),
  ];
  await Promise.all(files.map((f) => loadImage(f)));
}

window.addEventListener("resize", () => {
  if (stageW && stageH) {
    applyFit(stageW, stageH);
    render();
  }
});

document.addEventListener(
  "pointerdown",
  () => {
    startIntroMusic();
  },
  { capture: true }
);

(async function boot() {
  setCursor("tcross");
  applyFit(Math.floor(window.innerWidth / 4) || 200, Math.floor(window.innerHeight / 1.5) || 400);
  setCanvasBg("#000");
  render();
  try {
    await Promise.all([preloadGameplayAssets(), ensureAudio()]);
  } catch (e) {
    console.error(e);
  }
  await startRun();
})();
