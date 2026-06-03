let handpose;
let video;
let predictions = [];
let fingerTrail = [];
let modelReady = false; // 新增：追蹤模型是否載入完成
const TRAIL_LENGTH = 10; // 記錄最近 10 影格的座標

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 建立視訊捕捉物件
  // 使用更明確的物件格式，並加入錯誤處理
  video = createCapture(VIDEO, function(stream) {
    console.log("Camera stream ready");
  });
  
  video.size(width, height); // 設定視訊大小與畫布一致
  video.hide(); // 隱藏視訊元素，我們將其繪製到畫布上

  // 載入 Handpose 模型 (ml5 v1.0 語法：handPose)
  // 啟動持續偵測偵測模式
  if (ml5) {
    handpose = ml5.handPose(video, modelLoaded);
    handpose.detectStart(video, gotHands);
  } else {
    console.error("ml5.js failed to load!");
  }
}

function modelLoaded() {
  console.log("Handpose model loaded!");
  modelReady = true; // 模型載入完成後設為 true
}

function gotHands(results) {
  predictions = results;
}

function draw() {
  // --- 開始鏡像翻轉區塊 ---
  // 讓背景和刀光都在同一個鏡像座標系中，這樣座標才不會相反
  
  // 如果影片還沒準備好，先顯示黑色背景並提示
  if (!video || !video.elt.readyState) {
    background(0);
    fill(255);
    textAlign(CENTER, CENTER);
    text("Waiting for camera...", width / 2, height / 2);
    return;
  }

  push();
  translate(width, 0); 
  scale(-1, 1); 
  image(video, 0, 0, width, height);

  // 偵測到手部時，追蹤食指尖端並更新刀光軌跡
  if (predictions.length > 0) {
    let hand = predictions[0]; // 取得第一個偵測到的手
    
    // ml5 v1.0 的座標儲存在 keypoints 中，食指尖是 index 8
    let indexFingerTip = hand.keypoints[8];

    // 將當前食指尖端的位置加入軌跡陣列
    fingerTrail.push({ x: indexFingerTip.x, y: indexFingerTip.y });

    // 保持軌跡長度不超過 TRAIL_LENGTH
    if (fingerTrail.length > TRAIL_LENGTH) {
      fingerTrail.shift(); // 移除最舊的點
    }

    // 在食指尖端畫一個綠色點 (在鏡像座標系內繪製)
    fill(0, 255, 0);
    noStroke();
    circle(indexFingerTip.x, indexFingerTip.y, 15);
  } else {
    // 手消失時，讓軌跡慢慢縮減消失，而不是直接清空（更有動感）
    if (fingerTrail.length > 0) fingerTrail.shift();
  }

  // 繪製刀光特效
  if (fingerTrail.length > 1) {
    noFill();
    for (let i = 0; i < fingerTrail.length - 1; i++) {
      let p1 = fingerTrail[i];
      let p2 = fingerTrail[i + 1];

      // 特效：越舊的點越細、越透明
      let alpha = map(i, 0, fingerTrail.length - 1, 0, 255);
      let weight = map(i, 0, fingerTrail.length - 1, 1, 15);

      stroke(255, 255, 255, alpha); 
      strokeWeight(weight);
      line(p1.x, p1.y, p2.x, p2.y);
    }
  }
  pop(); // 結束鏡像翻轉區塊

  // 始終在左上角顯示狀態資訊 (放在 pop 之後確保文字不會被鏡像翻轉)
  push();
  fill(255, 255, 0); // 使用黃色文字
  noStroke();
  textAlign(LEFT, TOP);
  textSize(20);
  let modelStatus = modelReady ? "模型：已就緒" : "模型：載入中...";
  let handStatus = (predictions.length > 0) ? "偵測：已找到手" : "偵測：未發現手";
  text(`${modelStatus} | ${handStatus}`, 20, 20);
  pop();
}

// 當視窗大小改變時，調整畫布和視訊的大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height); // 視訊大小也需同步調整
}
