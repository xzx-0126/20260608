let video;
let handpose;
let predictions = []; 
let trail = []; // 儲存食指最近 10 影格座標的陣列
let fruits = []; // 儲存所有水果的陣列
let particles = []; // 儲存果汁粒子
let gravity = 0.2; // 全域重力變數
let score = 0; // 分數
let timer = 60; // 倒數計時
let modelLoaded = false; // 用於自我檢查模型載入狀態
let gameStartTime = 0; // 記錄遊戲開始時間
let waitingStartTime = 0; // 記錄進入等待狀態的時間
let gameState = "WAITING"; // 遊戲狀態：WAITING, PLAY, GAMEOVER

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);

  // 1. 初始化 Handpose 模型 (修正：v1.x 版為 handPose，大寫 P)
  handpose = ml5.handPose(video, () => {
    modelLoaded = true;
    console.log("Model Ready!");
    // 2. 修正：v1.x 建議使用 detectStart 來啟動持續偵測
    handpose.detectStart(video, (results) => {
      predictions = results;
    });
  });

  // 隱藏原始的 HTML 影片元件，我們要在畫布上繪製
  video.hide();

  // 初始化球與磚塊
  resetGame();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height);
}

function resetGame() {
  trail = []; // 重置遊戲時清空軌跡
  fruits = [];
  particles = [];
  score = 0;
  timer = 60;
  gameState = "WAITING";
  waitingStartTime = millis(); // 每次重置遊戲都重新計算等待時間
}

function draw() {
  // 確保每一幀都先清空畫布，避免產生黃色軌跡
  background(255);

  // 1. 處理水平鏡像：將畫布原點移至右側並翻轉 X 軸
  translate(width, 0);
  scale(-1, 1);

  // 繪製攝影機畫面
  image(video, 0, 0, width, height);

  // 2. 偵測邏輯
  if (predictions.length > 0) {
    // 取得第一隻偵測到的手
    let hand = predictions[0];
    
    // 3. 更新食指尖端座標 (新版資料結構：hand.index_finger_tip)
    let indexFinger = hand.index_finger_tip;
    
    // 直接儲存原始座標，因為在鏡像區塊內繪製時會自動對齊
    trail.push({ x: indexFinger.x, y: indexFinger.y });
    if (trail.length > 10) {
      trail.shift(); // 保持陣列長度為 10，移除最舊的座標
    }

    // 檢查是否「手部打開」以重新開始遊戲
    if (gameState === "GAMEOVER") {
      // 增加安全檢查，確保節點資料存在
      let isOpen = hand.index_finger_tip && hand.index_finger_pip && 
                   hand.index_finger_tip.y < hand.index_finger_pip.y &&
                   hand.middle_finger_tip.y < hand.middle_finger_pip.y &&
                   hand.ring_finger_tip.y < hand.ring_finger_pip.y;
      
      if (isOpen) {
        resetGame();
        gameState = "PLAY"; // 直接進入遊戲狀態
        gameStartTime = millis(); // 重新記錄遊戲開始時間
      }
    }

    // 如果目前在等待狀態且偵測到手，就開始遊戲
    if (gameState === "WAITING" && millis() - waitingStartTime > 1000) {
      gameState = "PLAY";
      gameStartTime = millis();
    }
  } else {
    // 如果畫面中沒有偵測到手，讓軌跡快速消失
    if (trail.length > 0) trail.splice(0, 1);
  }

  // --- [A] 鏡像繪製區塊 (包含手部特效、水果、粒子) ---
  // 這裡的座標系已經是鏡像的，直接繪製 raw 座標即可對齊畫面
  // 修正：增加 trail.length > 0 檢查，避免 resetGame 清空陣列後讀取 lastPt 導致卡住
  if (predictions.length > 0 && trail.length > 0) {
    let lastPt = trail[trail.length - 1];
    fill(0, 255, 0);
    noStroke();
    ellipse(lastPt.x, lastPt.y, 15, 15); // 綠色指尖點

    noFill();
    for (let i = 0; i < trail.length - 1; i++) {
      let p1 = trail[i];
      let p2 = trail[i + 1];
      let alpha = map(i, 0, trail.length - 1, 0, 255);
      let weight = map(i, 0, trail.length - 1, 1, 12);
      stroke(255, 255, 255, alpha);
      strokeWeight(weight);
      line(p1.x, p1.y, p2.x, p2.y);
    }
  }

  if (gameState === "PLAY") {
    // 水果生成
    if (frameCount % 45 === 0) { 
      fruits.push(new Fruit());
    }

    // 更新並繪製所有水果
    for (let i = fruits.length - 1; i >= 0; i--) {
      fruits[i].update();
      fruits[i].display();

      // 切割碰撞判定：直接使用 trail 陣列判定 (都在鏡像環境下，座標一致)
      if (fruits[i].checkSliced(trail)) {
        score += 10;
        // 噴發粒子
        for (let k = 0; k < random(15, 20); k++) {
          particles.push(new Particle(fruits[i].x, fruits[i].y, fruits[i].color));
        }
        fruits.splice(i, 1);
        continue;
      }

      if (fruits[i].offScreen()) {
        fruits.splice(i, 1);
      }
    }

    // 更新與繪製粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].display();
      if (particles[i].finished()) {
        particles.splice(i, 1);
      }
    }
  }

  // --- [B] UI 文字區塊 (需取消鏡像，確保文字不反轉) ---
  push();
  scale(-1, 1);
  translate(-width, 0);

  // 狀態列
  fill(0);
  noStroke();
  textSize(14);
  textAlign(LEFT);
  let statusText = !modelLoaded ? "🔄 模型載入中..." : (predictions.length > 0 ? "✅ 偵測中 (手部已發現)" : "❌ 未偵測到手部");
  text("狀態: " + statusText, 20, 30);
  
  if (gameState === "WAITING") {
    textAlign(CENTER);
    textSize(24);
    fill(0);
    text(!modelLoaded ? "Model Loading..." : "Ready! Please show your hand.", width / 2, height / 2);
    textSize(16);
    text("Please show your hand to the camera to start", width / 2, height / 2 + 40);

  } else if (gameState === "PLAY") {
    // 更新倒數計時
    let elapsed = floor((millis() - gameStartTime) / 1000);
    timer = 60 - elapsed;
    if (timer <= 0) {
      timer = 0;
      gameState = "GAMEOVER";
    }

    // 5. 顯示分數與時間
    textAlign(CENTER);
    textSize(36);
    fill(255);
    stroke(0);
    strokeWeight(5);
    text("SCORE: " + score, width / 2, 50);
    text("TIME: " + timer, width / 2, 95);

  } else {
    // 遊戲結束畫面
    textAlign(CENTER);
    textSize(48);
    fill(255, 0, 0);
    stroke(0);
    strokeWeight(6);
    text("GAME OVER", width / 2, height / 2);
    fill(0);
    noStroke();
    textSize(24);
    text("Final Score: " + score, width / 2, height / 2 + 50);
    text("Open Hand to Restart", width / 2, height / 2 + 100);
  }
  pop();
}

// --- 水果類別設計 ---
class Fruit {
  constructor() {
    this.radius = random(30, 50); // 隨機半徑
    // 從畫面底部隨機 X 位置出現
    this.x = random(this.radius, width - this.radius);
    this.y = height + this.radius;
    
    // 隨機初始速度
    this.vx = random(-2, 2); // 水平微偏移
    this.vy = random(-12, -18); // 往上噴發的初速度 (負值)
    
    this.isSliced = false;
    this.color = color(random(255), random(255), random(255));
  }

  update() {
    // 套用重力與速度
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
  }

  display() {
    if (!this.isSliced) {
      fill(this.color);
      noStroke();
      ellipse(this.x, this.y, this.radius * 2);
    }
  }

  // 檢查切割邏輯：只要指尖碰到邊緣或軌跡劃過就算
  checkSliced(trail) {
    if (trail.length === 0) return false;

    // 1. 優先檢查：最新的一個點是否在水果範圍內 (只要碰到邊緣就標記為切碎)
    let tip = trail[trail.length - 1];
    if (dist(tip.x, tip.y, this.x, this.y) < this.radius) {
      this.isSliced = true;
      return true;
    }

    // 2. 輔助檢查：遍歷軌跡中的線段，處理高速揮動的情況
    for (let j = 1; j < trail.length; j++) {
      let p1 = trail[j - 1];
      let p2 = trail[j];
      
      // 使用線段與圓形的碰撞偵測
      if (this.lineCircleIntersect(p1.x, p1.y, p2.x, p2.y, this.x, this.y, this.radius)) {
        this.isSliced = true;
        return true;
      }
    }
    return false;
  }

  // 線段與圓形碰撞偵測輔助函數
  lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
    // 計算線段長度平方
    let lenSq = pow(x2 - x1, 2) + pow(y2 - y1, 2);
    if (lenSq === 0) return dist(x1, y1, cx, cy) < r;

    // 取得圓心投影在直線上的比例 t，並限制在 0~1 (線段範圍內)
    let t = constrain(((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / lenSq, 0, 1);
    
    // 找到線段上距離圓心最近的點座標
    let closestX = x1 + t * (x2 - x1);
    let closestY = y1 + t * (y2 - y1);

    // 檢查該最近點與圓心的距離是否小於半徑 (回歸原大小)
    return dist(cx, cy, closestX, closestY) < r;
  }

  // 檢查是否掉出畫面底部
  offScreen() {
    return this.y > height + this.radius;
  }
}

// --- 粒子系統 (果汁噴濺) ---
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = random(4, 8);
    this.vx = random(-5, 5);
    this.vy = random(-5, 5);
    this.alpha = 255;
  }

  update() {
    this.vy += gravity; // 受重力影響
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 8; // 快速淡出
  }

  display() {
    noStroke();
    let c = color(red(this.color), green(this.color), blue(this.color), this.alpha);
    fill(c);
    ellipse(this.x, this.y, this.radius * 2);
  }

  finished() {
    return this.alpha < 0;
  }
}
