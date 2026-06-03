let video;
let handpose;
let predictions = []; 
let trail = []; // 儲存食指最近 10 影格座標的陣列
let fruits = []; // 儲存所有水果的陣列
let gravity = 0.2; // 全域重力變數
let modelLoaded = false; // 用於自我檢查模型載入狀態
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
  fruits = []; // 清空水果陣列
  gameState = "WAITING";
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
    
    // 更新食指軌跡座標
    trail.push({ x: indexFinger.x, y: indexFinger.y });
    if (trail.length > 10) {
      trail.shift(); // 保持陣列長度為 10，移除最舊的座標
    }

    // 在食指尖端畫一個小圓點，方便確認偵測位置
    fill(0, 255, 0);
    noStroke();
    ellipse(indexFinger.x, indexFinger.y, 15, 15);

    // 繪製刀光特效：連點成線，並隨新舊程度調整粗細與透明度
    noFill();
    for (let i = 0; i < trail.length - 1; i++) {
      let p1 = trail[i];
      let p2 = trail[i + 1];
      // i 越大代表座標越新。我們讓 alpha 與重量隨 i 增加
      let alpha = map(i, 0, trail.length - 1, 0, 255);
      let weight = map(i, 0, trail.length - 1, 1, 12);
      stroke(255, 255, 255, alpha); // 白色發光特效
      strokeWeight(weight);
      line(p1.x, p1.y, p2.x, p2.y);
    }

    // 檢查是否「手部打開」以重新開始遊戲
    if (gameState === "GAMEOVER") {
      let isOpen = hand.index_finger_tip.y < hand.index_finger_pip.y &&
                   hand.middle_finger_tip.y < hand.middle_finger_pip.y &&
                   hand.ring_finger_tip.y < hand.ring_finger_pip.y &&
                   hand.pinky_finger_tip.y < hand.pinky_finger_pip.y;
      
      if (isOpen) {
        resetGame();
        gameState = "PLAY";
      }
    }

    // 如果目前在等待狀態且偵測到手，就開始遊戲
    if (gameState === "WAITING") {
      gameState = "PLAY";
    }
  } else {
    // 如果畫面中沒有偵測到手，讓軌跡快速消失
    if (trail.length > 0) trail.shift();
  }

  // 自我檢查 UI (不論遊戲狀態，都顯示在最上層)
  push();
  scale(-1, 1);
  translate(-width, 0);
  fill(0);
  textSize(14);
  textAlign(LEFT);
  let statusText = !modelLoaded ? "🔄 模型載入中..." : (predictions.length > 0 ? "✅ 偵測中 (手部已發現)" : "❌ 未偵測到手部");
  text("狀態: " + statusText, 20, 30);
  pop();

  if (gameState === "WAITING") {
    // 等待偵測的畫面
    push();
    scale(-1, 1);
    translate(-width, 0);
    fill(0);
    textAlign(CENTER);
    textSize(24);
    text(!modelLoaded ? "Model Loading..." : "Ready! Please show your hand.", width / 2, height / 2);
    textSize(16);
    text("Please show your hand to the camera to start", width / 2, height / 2 + 40);
    pop();
  } else if (gameState === "PLAY") {
    // 遊戲進行中
    // 1. 每隔一段影格隨機生成一個水果
    if (frameCount % 60 === 0) { // 約一秒生成一個
      fruits.push(new Fruit());
    }

    // 2. 更新並繪製所有水果
    for (let i = fruits.length - 1; i >= 0; i--) {
      fruits[i].update();
      fruits[i].display();

      // 3. 如果水果掉出畫面底部，則移除該水果物件
      if (fruits[i].offScreen()) {
        fruits.splice(i, 1);
      }
    }
  } else {
    // 遊戲結束畫面 (需要處理鏡像文字問題)
    // 注意：目前尚未實作 GAMEOVER 的觸發條件（例如漏接水果）

    push();
    scale(-1, 1); // 再次翻轉回來讓文字正常
    translate(-width, 0);
    fill(0); // 將文字改為黑色
    textAlign(CENTER);
    textSize(48);
    text("GAME OVER", width / 2, height / 2);
    textSize(20);
    text("Open Hand to Restart", width / 2, height / 2 + 50);
    pop();
  }
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

  // 檢查是否掉出畫面底部
  offScreen() {
    return this.y > height + this.radius;
  }
}
