import * as THREE from "three"; // 匯入 Three.js 以繪製 3D 場景
const scene = new THREE.Scene(); // 建立浮島公園的 3D 場景
scene.background = new THREE.Color("#a9dce6"); // 設定與水面相襯的淡藍背景
const camera = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 120); // 建立正交攝影機避免透視變形
const initialAspect = window.innerWidth / window.innerHeight; // 計算初始視窗的寬高比例
const initialHalfHeight = Math.max(14.5, 18 / initialAspect); // 依畫面比例決定初始垂直視野
camera.left = -initialHalfHeight * initialAspect; // 依初始比例設定攝影機左側範圍
camera.right = initialHalfHeight * initialAspect; // 依初始比例設定攝影機右側範圍
camera.top = initialHalfHeight; // 設定攝影機初始上側範圍
camera.bottom = -initialHalfHeight; // 設定攝影機初始下側範圍
const renderer = new THREE.WebGLRenderer({ antialias: true }); // 建立啟用抗鋸齒的 WebGL 渲染器
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素倍率以平衡畫質與效能
renderer.setSize(window.innerWidth, window.innerHeight); // 將渲染畫布設定為視窗大小
renderer.shadowMap.enabled = true; // 啟用場景陰影
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 使用柔和的陰影過濾方式
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 使用電影色調映射改善明暗層次
renderer.toneMappingExposure = 1.12; // 微調渲染曝光讓場景保持明亮
document.querySelector("#scene").appendChild(renderer.domElement); // 將 3D 畫布放進場景容器
const hemiLight = new THREE.HemisphereLight("#efffff", "#527b79", 2.1); // 建立柔和的天空與地面環境光
scene.add(hemiLight); // 將環境光加入場景
const sunLight = new THREE.DirectionalLight("#fff1c9", 3.2); // 建立帶有暖色調的方向光
sunLight.position.set(-8, 18, 11); // 將主光源放在場景左上方
sunLight.castShadow = true; // 讓主光源投射物件陰影
sunLight.shadow.mapSize.set(2048, 2048); // 提高陰影貼圖解析度
sunLight.shadow.camera.left = -24; // 設定陰影攝影機左側範圍
sunLight.shadow.camera.right = 24; // 設定陰影攝影機右側範圍
sunLight.shadow.camera.top = 24; // 設定陰影攝影機上側範圍
sunLight.shadow.camera.bottom = -24; // 設定陰影攝影機下側範圍
sunLight.shadow.bias = -0.00035; // 減少陰影表面的條紋瑕疵
sunLight.shadow.radius = 5; // 加大陰影柔化半徑
scene.add(sunLight); // 將主光源加入場景
const waterMaterial = new THREE.MeshStandardMaterial({ color: "#79c9d8", roughness: 0.42, metalness: 0.04 }); // 建立淡藍色水面的材質
const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 56, 56), waterMaterial); // 建立可變形的細分海面網格
water.rotation.x = -Math.PI / 2; // 將平面轉為水平水面
water.position.y = -0.16; // 將水面放在平台下方
water.receiveShadow = true; // 讓水面承接浮島投下的陰影
scene.add(water); // 將水面加入場景
const park = new THREE.Group(); // 建立方便整體控制的公園群組
scene.add(park); // 將公園群組加入場景
const walkers = []; // 儲存場景中所有持續行走的角色
const seaBirds = []; // 儲存沿海面盤旋的海鳥群
const fishSchools = []; // 儲存成群游動的海魚
const boats = []; // 儲存沿海面緩慢漂行的小船
const walkableAreas = []; // 儲存角色可以站立與行走的平台矩形區域
const solidColliders = []; // 儲存樹木、建築與設施的碰撞形狀
const stampSites = []; // 儲存地圖上的集章點、說明與完成狀態
const cameraFocus = new THREE.Vector3(0, 0.65, 0); // 設定平滑跟拍攝影機目前的注視位置
const desiredCameraFocus = new THREE.Vector3(); // 儲存跟拍攝影機預期的注視位置
let player = null; // 儲存由方向鍵或滑鼠控制的主角
let activeStamp = null; // 儲存最近完成的集章地點
let completedStamps = 0; // 記錄已經完成的集章數量
let playerWalkTime = 0; // 累計主角正在行走的動畫時間
const materials = { // 集中管理場景中的共用材質
  platform: new THREE.MeshStandardMaterial({ color: "#e8e4d4", roughness: 0.88 }), // 建立淺米灰色平台材質
  path: new THREE.MeshStandardMaterial({ color: "#c5d3c3", roughness: 0.9 }), // 建立公園步道材質
  grass: new THREE.MeshStandardMaterial({ color: "#8eae76", roughness: 1 }), // 建立公園與鄉村草地材質
  cityGround: new THREE.MeshStandardMaterial({ color: "#c7d0cd", roughness: 0.92 }), // 建立城市平台地面材質
  asphalt: new THREE.MeshStandardMaterial({ color: "#596b70", roughness: 0.9 }), // 建立城市道路材質
  marking: new THREE.MeshStandardMaterial({ color: "#f4e3a8", roughness: 0.8 }), // 建立道路標線材質
  cityWall: new THREE.MeshStandardMaterial({ color: "#d8e0dc", roughness: 0.74 }), // 建立現代建築淺色外牆材質
  cityWarm: new THREE.MeshStandardMaterial({ color: "#d5a77f", roughness: 0.82 }), // 建立住宅暖色外牆材質
  window: new THREE.MeshStandardMaterial({ color: "#65a8b2", roughness: 0.34, metalness: 0.18 }), // 建立城市玻璃窗材質
  techGlass: new THREE.MeshStandardMaterial({ color: "#4e8e9b", roughness: 0.25, metalness: 0.35 }), // 建立科技城藍綠玻璃材質
  techGlow: new THREE.MeshStandardMaterial({ color: "#8be5dc", emissive: "#3bafa9", emissiveIntensity: 0.5, roughness: 0.3 }), // 建立科技城發光裝飾材質
  roof: new THREE.MeshStandardMaterial({ color: "#a95f48", roughness: 0.92 }), // 建立鄉村屋頂材質
  ruralWall: new THREE.MeshStandardMaterial({ color: "#e8d2a7", roughness: 0.9 }), // 建立鄉村住宅牆面材質
  cropA: new THREE.MeshStandardMaterial({ color: "#a4bd55", roughness: 1 }), // 建立淺色農作物材質
  cropB: new THREE.MeshStandardMaterial({ color: "#718e3f", roughness: 1 }), // 建立深色農作物材質
  soil: new THREE.MeshStandardMaterial({ color: "#957c55", roughness: 1 }), // 建立農田土壤材質
  pond: new THREE.MeshStandardMaterial({ color: "#64b8c2", roughness: 0.28, metalness: 0.12 }), // 建立公園池塘水面材質
  stripeYellow: new THREE.MeshStandardMaterial({ color: "#f6c744", roughness: 0.68 }), // 建立警示條紋黃色材質
  stripeBlack: new THREE.MeshStandardMaterial({ color: "#28363a", roughness: 0.72 }), // 建立警示條紋黑色材質
  rail: new THREE.MeshStandardMaterial({ color: "#f3bf37", roughness: 0.48, metalness: 0.08 }), // 建立橋面欄杆的黃色材質
  wood: new THREE.MeshStandardMaterial({ color: "#a86d48", roughness: 0.78 }), // 建立長椅木質材質
  trunk: new THREE.MeshStandardMaterial({ color: "#79563d", roughness: 1 }), // 建立樹幹材質
  leafA: new THREE.MeshStandardMaterial({ color: "#438d6b", roughness: 1, flatShading: true }), // 建立深綠色低多邊形樹葉材質
  leafB: new THREE.MeshStandardMaterial({ color: "#73aa70", roughness: 1, flatShading: true }), // 建立淺綠色低多邊形樹葉材質
  lamp: new THREE.MeshStandardMaterial({ color: "#f2dfad", emissive: "#f3ce75", emissiveIntensity: 0.45, roughness: 0.35 }), // 建立微微發光的路燈燈罩材質
  metal: new THREE.MeshStandardMaterial({ color: "#596b68", roughness: 0.5, metalness: 0.36 }), // 建立長椅支架與燈柱材質
  skin: new THREE.MeshStandardMaterial({ color: "#e9b38e", roughness: 0.92 }), // 建立行人臉部與手部材質
  pants: new THREE.MeshStandardMaterial({ color: "#526c7c", roughness: 0.9 }), // 建立行人褲裝材質
  eye: new THREE.MeshStandardMaterial({ color: "#263b42", roughness: 0.8 }), // 建立行人眼睛與五官材質
  backpack: new THREE.MeshStandardMaterial({ color: "#456d5c", roughness: 0.88 }), // 建立行人背包材質
  schoolWall: new THREE.MeshStandardMaterial({ color: "#eadfca", roughness: 0.88 }), // 建立校舍暖白色外牆
  schoolRoof: new THREE.MeshStandardMaterial({ color: "#b9584b", roughness: 0.9 }), // 建立校舍磚紅色屋頂
  shopGreen: new THREE.MeshStandardMaterial({ color: "#3e9670", roughness: 0.72 }), // 建立便利商店綠色招牌
  postRed: new THREE.MeshStandardMaterial({ color: "#d34e48", roughness: 0.74 }), // 建立郵局紅色招牌與郵筒
  policeBlue: new THREE.MeshStandardMaterial({ color: "#417ba2", roughness: 0.74 }), // 建立警察局藍色識別色
  clinicMint: new THREE.MeshStandardMaterial({ color: "#d8ebe1", roughness: 0.84 }), // 建立衛生所薄荷白外牆
  clinicRed: new THREE.MeshStandardMaterial({ color: "#d94f4a", roughness: 0.7 }) // 建立衛生所紅十字識別色
}; // 結束共用材質設定
const platformSpecs = [ // 定義中央與四周共五座平台
  { x: 0, z: 0, size: 10.4, kind: "學校" }, // 建立中央校園平台
  { x: 12.4, z: 0, size: 9.2, kind: "便利商店" }, // 建立東側便利商店平台
  { x: -12.4, z: 0, size: 9.2, kind: "郵局" }, // 建立西側郵局平台
  { x: 0, z: -12.4, size: 9.2, kind: "警察局" }, // 建立北側警察局平台
  { x: 0, z: 12.4, size: 9.2, kind: "衛生所" } // 建立南側衛生所平台
]; // 結束平台位置設定
const bridgeGates = [ // 記錄中央公園與四座外島之間的橋面通行中心點
  null, // 中央平台本身不需要外島橋口
  { center: { x: 5.2, z: 0 }, outer: { x: 7.8, z: 0 } }, // 設定東側城市橋面的中央端與外島端
  { center: { x: -5.2, z: 0 }, outer: { x: -7.8, z: 0 } }, // 設定西側城市橋面的中央端與外島端
  { center: { x: 0, z: -5.2 }, outer: { x: 0, z: -7.8 } }, // 設定科技城橋面的中央端與外島端
  { center: { x: 0, z: 5.2 }, outer: { x: 0, z: 7.8 } } // 設定鄉村橋面的中央端與外島端
]; // 結束五島橋口路徑資料
function addBox(parent, width, height, depth, material, x, y, z) { // 建立可重複使用的方塊物件
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); // 建立指定尺寸的方塊網格
  mesh.position.set(x, y, z); // 設定方塊在場景中的位置
  mesh.castShadow = true; // 讓方塊投射柔和陰影
  mesh.receiveShadow = true; // 讓方塊表面承接其他物件陰影
  parent.add(mesh); // 將方塊加入指定群組
  return mesh; // 回傳方塊以便後續調整
} // 結束方塊建立工具
function addCylinder(parent, radiusTop, radiusBottom, height, material, x, y, z, segments = 8) { // 建立低多邊形圓柱物件
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material); // 建立指定形狀的圓柱網格
  mesh.position.set(x, y, z); // 設定圓柱在場景中的位置
  mesh.castShadow = true; // 讓圓柱投射柔和陰影
  mesh.receiveShadow = true; // 讓圓柱表面承接其他物件陰影
  parent.add(mesh); // 將圓柱加入指定群組
  return mesh; // 回傳圓柱以便後續調整
} // 結束圓柱建立工具
function addSphere(parent, radius, material, x, y, z, widthSegments = 7, heightSegments = 5) { // 建立低多邊形球體物件
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material); // 建立低面數球體網格
  mesh.position.set(x, y, z); // 設定球體在場景中的位置
  mesh.castShadow = true; // 讓球體投射柔和陰影
  mesh.receiveShadow = true; // 讓球體表面承接其他物件陰影
  parent.add(mesh); // 將球體加入指定群組
  return mesh; // 回傳球體以便後續調整
} // 結束球體建立工具
function registerCollider(parent, x, z, halfX, halfZ) { // 以平台群組座標登記方形障礙碰撞盒
  const origin = parent.getWorldPosition(new THREE.Vector3()); // 取得平台群組的世界座標原點
  solidColliders.push({ x: origin.x + x, z: origin.z + z, halfX, halfZ }); // 儲存方形障礙中心與半寬
} // 結束方形碰撞盒登記
function registerObjectCollider(object, halfX, halfZ = halfX) { // 以已定位物件登記方形障礙碰撞盒
  const center = object.getWorldPosition(new THREE.Vector3()); // 取得物件的世界座標中心
  solidColliders.push({ x: center.x, z: center.z, halfX, halfZ }); // 儲存物件碰撞盒的世界座標
} // 結束物件碰撞盒登記
function registerObjectCircle(object, radius) { // 以已定位物件登記圓形障礙碰撞體
  const center = object.getWorldPosition(new THREE.Vector3()); // 取得物件的世界座標中心
  solidColliders.push({ x: center.x, z: center.z, radius }); // 儲存圓形障礙中心與半徑
} // 結束圓形碰撞體登記
function registerWalkableRect(centerX, centerZ, width, depth, groundY, kind) { // 登記平台或橋面的可走矩形與射線地面
  walkableAreas.push({ minX: centerX - width / 2, maxX: centerX + width / 2, minZ: centerZ - depth / 2, maxZ: centerZ + depth / 2, groundY, kind }); // 儲存世界座標步行邊界與地面高度
} // 結束可走地面登記
function getWalkableArea(x, z, margin = 0.22) { // 找出角色目前座標下方的平台或橋面
  let platformArea = null; // 暫存一般平台的可走區域
  for (const area of walkableAreas) { // 逐一檢查已登記的地面區域
    const inside = x >= area.minX + margin && x <= area.maxX - margin && z >= area.minZ + margin && z <= area.maxZ - margin; // 檢查角色中心是否仍在安全步行範圍
    if (!inside) continue; // 略過超出目前區域的地面
    if (area.kind === "bridge") return area; // 優先採用平台交界處的橋面高度
    platformArea ??= area; // 記錄符合條件的平台地面
  } // 結束地面區域檢查
  return platformArea; // 回傳平台地面或無法行走的空值
} // 結束可走區域查找
function isBlockedAt(x, z, radius = 0.22) { // 檢查角色圓形足跡是否碰到任一障礙
  for (const collider of solidColliders) { // 逐一檢查地圖中的障礙物
    if (collider.radius) { // 使用圓形碰撞模型檢查樹木與圓柱設施
      if (Math.hypot(x - collider.x, z - collider.z) < radius + collider.radius) return true; // 判斷兩個圓形是否重疊
      continue; // 圓形障礙已完成檢查並繼續下一個物件
    } // 結束圓形障礙檢查
    const nearestX = THREE.MathUtils.clamp(x, collider.x - collider.halfX, collider.x + collider.halfX); // 取得矩形碰撞盒上最近的水平點
    const nearestZ = THREE.MathUtils.clamp(z, collider.z - collider.halfZ, collider.z + collider.halfZ); // 取得矩形碰撞盒上最近的深度點
    if (Math.hypot(x - nearestX, z - nearestZ) < radius) return true; // 判斷角色足跡是否碰到矩形障礙
  } // 結束所有障礙碰撞檢查
  return false; // 沒有任何障礙時允許通過
} // 結束障礙碰撞查詢
function movePlayerBy(deltaX, deltaZ) { // 以分軸碰撞解析角色移動並保留沿牆滑動
  if (!player) return false; // 主角尚未建立時不執行移動
  const radius = 0.2; // 設定主角足跡的碰撞半徑
  let moved = false; // 記錄本次移動是否成功
  const nextX = player.position.x + deltaX; // 計算候選水平位置
  const horizontalArea = getWalkableArea(nextX, player.position.z, radius); // 確認候選水平位置仍在平台或橋面
  if (horizontalArea && !isBlockedAt(nextX, player.position.z, radius)) { // 確認水平移動不會掉出地面或穿過障礙
    player.position.x = nextX; // 套用水平移動以便沿障礙側邊滑動
    player.position.y = horizontalArea.groundY; // 依所在平台或橋面更新主角高度
    moved = true; // 記錄水平移動已成功
  } // 結束水平軸碰撞解析
  const nextZ = player.position.z + deltaZ; // 計算候選深度位置
  const verticalArea = getWalkableArea(player.position.x, nextZ, radius); // 確認候選深度位置仍在平台或橋面
  if (verticalArea && !isBlockedAt(player.position.x, nextZ, radius)) { // 確認深度移動不會掉出地面或穿過障礙
    player.position.z = nextZ; // 套用深度移動以便沿障礙側邊滑動
    player.position.y = verticalArea.groundY; // 依所在平台或橋面更新主角高度
    moved = true; // 記錄深度移動已成功
  } // 結束深度軸碰撞解析
  return moved; // 回報本次移動是否成功
} // 結束角色分軸移動
function createPlatform(spec) { // 建立單座帶有斜紋側面的主題方形平台
  const group = new THREE.Group(); // 建立平台專屬群組
  group.position.set(spec.x, 0, spec.z); // 將平台群組移到指定位置
  park.add(group); // 將平台群組加入總場景
  registerWalkableRect(spec.x, spec.z, spec.size + 0.1, spec.size + 0.1, 1, "platform"); // 登記平台頂面供移動與點地使用
  addBox(group, spec.size, 0.9, spec.size, materials.platform, 0, 0.42, 0); // 建立厚實的方形平台本體
  addHazardStripes(group, spec.size); // 為平台四周鋪設連續斜向黃黑安全護條
  const groundMaterial = spec.kind === "學校" ? materials.grass : materials.cityGround; // 依平台主題選擇校園草地或服務島鋪面
  addBox(group, spec.size - 0.42, 0.075, spec.size - 0.42, groundMaterial, 0, 0.91, 0); // 鋪設平台頂面的主題地坪
  if (spec.kind === "學校") createSchoolDistrict(group, spec); // 建立操場與教學大樓組成的中央校園
  else createServiceDistrict(group, spec); // 建立便利商店或公共服務機關
  return group; // 回傳平台群組供後續使用
} // 結束主題平台建立流程
function addHazardStripes(parent, size) { // 為方形平台建立連續底帶與等距斜紋
  const edge = size / 2 + 0.018; // 設定護條貼在平台四側外緣的位置
  const panelHeight = 0.76; // 設定連續黃色護條的高度
  const panelY = 0.43; // 將護條中心對齊平台側面高度
  const southPanel = addBox(parent, size, panelHeight, 0.065, materials.stripeYellow, 0, panelY, edge); // 建立平台南側連續黃色底帶
  const northPanel = addBox(parent, size, panelHeight, 0.065, materials.stripeYellow, 0, panelY, -edge); // 建立平台北側連續黃色底帶
  const eastPanel = addBox(parent, 0.065, panelHeight, size, materials.stripeYellow, edge, panelY, 0); // 建立平台東側連續黃色底帶
  const westPanel = addBox(parent, 0.065, panelHeight, size, materials.stripeYellow, -edge, panelY, 0); // 建立平台西側連續黃色底帶
  for (const panel of [southPanel, northPanel, eastPanel, westPanel]) { // 關閉護條底帶不必要的陰影計算
    panel.castShadow = false; // 避免底帶重複投射粗糙陰影
    panel.receiveShadow = false; // 保留平整鮮明的黃色警示底色
  } // 結束底帶陰影設定
  const stripeSpacing = 0.62; // 設定黑色斜紋之間的固定間距
  for (let offset = -size / 2 + stripeSpacing / 2; offset < size / 2; offset += stripeSpacing) { // 沿平台四側均勻排列黑色斜條
    const southStripe = addBox(parent, 0.19, 0.9, 0.08, materials.stripeBlack, offset, panelY, edge + 0.01); // 在南側黃色底帶上貼黑色斜條
    const northStripe = addBox(parent, 0.19, 0.9, 0.08, materials.stripeBlack, offset, panelY, -edge - 0.01); // 在北側黃色底帶上貼黑色斜條
    const eastStripe = addBox(parent, 0.08, 0.9, 0.19, materials.stripeBlack, edge + 0.01, panelY, offset); // 在東側黃色底帶上貼黑色斜條
    const westStripe = addBox(parent, 0.08, 0.9, 0.19, materials.stripeBlack, -edge - 0.01, panelY, offset); // 在西側黃色底帶上貼黑色斜條
    southStripe.rotation.z = -0.55; // 將南側黑條旋成一致的斜紋
    northStripe.rotation.z = -0.55; // 將北側黑條旋成一致的斜紋
    eastStripe.rotation.x = 0.55; // 將東側黑條旋成一致的斜紋
    westStripe.rotation.x = 0.55; // 將西側黑條旋成一致的斜紋
    for (const stripe of [southStripe, northStripe, eastStripe, westStripe]) { // 關閉斜紋零件不必要的陰影計算
      stripe.castShadow = false; // 避免斜紋在側面產生塊狀陰影
      stripe.receiveShadow = false; // 保持黃黑對比邊緣清晰
    } // 結束斜紋陰影設定
  } // 結束平台四側斜紋鋪設
} // 結束平台警示護條建立
function createSchoolDistrict(parent, spec) { // 建立中央校園、操場與教學大樓
  addBox(parent, spec.size - 1.1, 0.07, 0.64, materials.path, 0, 0.99, 0); // 鋪設校園東西向中央步道
  addBox(parent, 0.64, 0.07, spec.size - 1.1, materials.path, 0, 0.99, 0); // 鋪設校園南北向中央步道
  addBox(parent, 5.2, 0.055, 2.55, materials.grass, 0, 0.99, -1.8); // 建立開闊的校園操場草地
  addBox(parent, 4.8, 0.025, 0.08, materials.marking, 0, 1.03, -1.8); // 在操場上畫出橫向白色球場線
  addBox(parent, 0.08, 0.025, 2.2, materials.marking, 0, 1.03, -1.8); // 在操場中央畫出縱向白色球場線
  createCivicBuilding(parent, "學校", -1.65, 2.7, 3.55, 2.5, 2.65); // 在操場北側建造紅瓦教學大樓
  createTree(parent, -4.1, 1, 3.55, 0.62); // 在校園西北邊緣保留一棵樹
  createTree(parent, -4.0, 1, -3.45, 0.58); // 在校園西南邊緣保留一棵樹
  createBench(parent, -2.85, 1, 0.8, Math.PI / 2); // 在操場西側保留一張長椅
  spawnWalker(parent, { x: -0.75, z: 0.45, radiusX: 0.82, radiusZ: 0.14, phase: 0.3 }, { shirtColor: "#e0a947", hairColor: "#493126", backpack: true }); // 安排一位學生沿校園步道行走
  spawnWalker(parent, { x: -2.8, z: -1.85, radiusX: 0.9, radiusZ: 0.16, phase: 2.6 }, { shirtColor: "#527fa0", hairColor: "#493126", backpack: true }); // 安排另一位學生沿操場外側步道行走
  createFishingShore(parent); // 在校園東側水岸建造木棧釣魚區
} // 結束中央校園景觀配置
function createFishingShore(parent) { // 在校園水岸放置白衣藍帽釣魚者
  const dockX = 4.12; // 設定伸向校園東岸的木棧板位置
  const dockZ = -1.82; // 設定木棧板沿岸的深度位置
  addBox(parent, 1.72, 0.14, 2.45, materials.wood, dockX, 1.02, dockZ); // 鋪設靠近水面的長方形木棧板
  for (let plank = 0; plank < 6; plank += 1) addBox(parent, 1.66, 0.025, 0.035, materials.platform, dockX, 1.105, dockZ - 0.98 + plank * 0.39); // 在木棧板上刻出間隔清楚的木板接縫
  const fisher = makeChibi({ shirtColor: "#fbfaf3", hairColor: "#4d3b31", hat: true, hatColor: "#347db8" }); // 用 makeChibi 建立白衣藍帽釣魚者
  fisher.scale.setScalar(0.9); // 將岸邊釣魚者調整為自然比例
  fisher.position.set(3.55, 1.1, dockZ); // 將釣魚者放在棧板靠岸的一側
  fisher.rotation.y = -Math.PI / 2; // 讓釣魚者面向東側海面
  fisher.userData.walkJoints.rightArm.rotation.x = 1.05; // 抬起右手握住釣竿
  fisher.userData.walkJoints.leftArm.rotation.x = 0.55; // 抬起左手扶穩釣竿
  parent.add(fisher); // 將釣魚者加入校園水岸場景
  const rodGrip = new THREE.Group(); // 建立固定在右手掌上的釣竿握把群組
  rodGrip.position.set(0, -0.37, -0.01); // 將握把接在右手關節末端
  fisher.userData.walkJoints.rightArm.add(rodGrip); // 將握把掛接到 makeChibi 的右手關節
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 1.8, 7), materials.wood); // 建立細長的木製釣竿
  rod.rotation.x = -Math.PI / 2; // 將釣竿長軸轉向人物正前方
  rod.position.z = -0.82; // 讓釣竿從掌心延伸至岸邊水面
  rodGrip.add(rod); // 將釣竿固定在手掌握把上
  const fishingLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(4.78, 1.78, dockZ - 0.1), new THREE.Vector3(5.42, -0.04, dockZ - 0.1)]), new THREE.LineBasicMaterial({ color: "#557d8b" })); // 建立從竿尖垂向海面的細釣線
  parent.add(fishingLine); // 將釣線延伸到校園東岸外的海面
  addSphere(parent, 0.075, materials.postRed, 5.42, -0.035, dockZ - 0.1, 7, 5); // 在海面釣線末端加上紅色浮標
} // 結束水岸釣魚場景建立
function createServiceDistrict(parent, spec) { // 建立便利商店、郵局、警察局或衛生所街區
  addBox(parent, spec.size - 0.75, 0.075, 0.78, materials.asphalt, 0, 0.99, 0); // 鋪設街區東西向主要道路
  addBox(parent, 0.78, 0.075, spec.size - 0.75, materials.asphalt, 0, 0.99, 0); // 鋪設街區南北向主要道路
    for (let marker = -3; marker <= 3; marker += 1) { // 沿公共服務道路放置短型行車標線
      addBox(parent, 0.38, 0.025, 0.06, materials.marking, marker * 0.78, 1.04, 0); // 標示東西向道路的中央虛線
      addBox(parent, 0.06, 0.025, 0.38, materials.marking, 0, 1.04, marker * 0.78); // 標示南北向道路的中央虛線
  } // 結束公共服務街區路標配置
  createCivicBuilding(parent, spec.kind, 0, 2.7, 3.1, 2.2, 2.2); // 在街區北側建造主題公共服務建築
  createCityBuilding(parent, -3.35, 2.75, 1.08, 1.18, 1.65, 1, false); // 在街區西北邊緣保留一棟小型配樓
  createCityBuilding(parent, 3.35, 2.75, 1.08, 1.18, 1.75, 2, false); // 在街區東北邊緣保留一棟小型配樓
  if (spec.kind === "郵局") addCivicProp(parent, "郵筒", materials.postRed, -2.1, 1.24, 1.55); // 在郵局前放置紅色郵筒
  if (spec.kind === "警察局") createPoliceCar(parent, 2.35, -2.15); // 將巡邏車停在東南側停車位
  spawnWalker(parent, { x: -0.15, z: -1.45, radiusX: 0.92, radiusZ: 0.14, phase: spec.x + 0.8 }, { shirtColor: spec.kind === "警察局" ? "#436f9b" : "#4f91a0", hairColor: "#3b2b26", helmet: spec.kind === "警察局", backpack: spec.kind !== "警察局" }); // 每座服務島保留一位行人並避開通道
  spawnWalker(parent, { x: 2.25, z: 0.15, radiusX: 0.14, radiusZ: 0.9, phase: spec.z + 3.1 }, { shirtColor: spec.kind === "警察局" ? "#426f9a" : "#d2a64e", hairColor: "#493126", helmet: spec.kind === "警察局" }); // 安排第二位居民沿另一側步道巡行
} // 結束公共服務街區景觀配置
function createCivicBuilding(parent, kind, x, z, width, depth, height) { // 建立具有各機關識別色的主題建築
  const palettes = { // 對照學校與公共服務機關的建築配色
    "學校": { wall: materials.schoolWall, accent: materials.schoolRoof }, // 設定學校的暖白牆與磚紅屋頂
    "便利商店": { wall: materials.cityWall, accent: materials.shopGreen }, // 設定便利商店的淺牆與綠色招牌
    "郵局": { wall: materials.ruralWall, accent: materials.postRed }, // 設定郵局的米白牆與紅色招牌
    "警察局": { wall: materials.cityWall, accent: materials.policeBlue }, // 設定警察局的白牆與藍色招牌
    "衛生所": { wall: materials.clinicMint, accent: materials.clinicRed } // 設定衛生所的薄荷白牆與紅十字
  }; // 結束公共建築配色對照
  const palette = palettes[kind]; // 讀取目前公共建築的專屬配色
    const groundY = 1; // 設定建築物與島面鋪地的接合高度
  const frontZ = z - depth / 2 - 0.045; // 計算建築朝向中央道路的正面位置
  addBox(parent, width, height, depth, palette.wall, x, groundY + height / 2, z); // 建立主題公共建築的方形主體
  registerCollider(parent, x, z, width / 2 + 0.12, depth / 2 + 0.12); // 登記公共建築底部碰撞區避免公仔穿牆
  addBox(parent, width + 0.18, 0.16, depth + 0.18, palette.accent, x, groundY + height + 0.08, z); // 以完整色塊加大屋頂機關識別色
  addBox(parent, width - 0.22, 0.3, 0.08, palette.accent, x, groundY + height - 0.4, frontZ); // 在建築正面設置大型彩色招牌底板
  for (const windowX of [-width * 0.28, width * 0.28]) addWindow(parent, 0.44, 0.42, 0.04, materials.window, x + windowX, groundY + 0.9, frontZ - 0.045); // 在建築正面安裝兩扇玻璃窗
  addBox(parent, 0.42, 0.82, 0.08, materials.wood, x, groundY + 0.45, frontZ - 0.05); // 在建築正面安裝中央入口門
  if (kind === "學校") { // 為校舍建造醒目的紅瓦屋頂與校徽
    const roofLeft = addBox(parent, width * 0.58, 0.16, depth + 0.22, materials.schoolRoof, x - width * 0.24, groundY + height + 0.2, z); // 建立校舍左側斜屋頂
    const roofRight = addBox(parent, width * 0.58, 0.16, depth + 0.22, materials.schoolRoof, x + width * 0.24, groundY + height + 0.2, z); // 建立校舍右側斜屋頂
    roofLeft.rotation.z = -0.42; // 將左屋頂調成斜面
    roofRight.rotation.z = 0.42; // 將右屋頂調成斜面
    addBox(parent, 0.52, 0.46, 0.1, materials.marking, x, groundY + height - 0.42, frontZ - 0.1); // 在校舍正面加上高對比校徽牌
    addSphere(parent, 0.22, materials.schoolRoof, x, groundY + height - 0.4, frontZ - 0.17, 8, 6); // 在校徽牌中央加上圓形學校識別章
  } // 結束校舍屋頂與校徽配置
  if (kind === "便利商店") addBox(parent, width + 0.26, 0.16, 0.42, materials.postRed, x, groundY + height - 0.72, z - depth / 2 - 0.22); // 在便利商店綠招牌下加紅色遮雨棚
  if (kind === "郵局") addCivicProp(parent, "郵件投入口", materials.postRed, x + width / 2 + 0.32, groundY + 0.72, z - depth / 2 - 0.2); // 在郵局外牆旁設置郵筒
  if (kind === "郵局") { // 在郵局屋頂加上俯視可辨認的信封圖案
    addBox(parent, 0.88, 0.055, 0.52, materials.schoolWall, x, groundY + height + 0.19, z); // 建立信封淺色底板
    const envelopeLeft = addBox(parent, 0.48, 0.035, 0.045, materials.postRed, x - 0.11, groundY + height + 0.23, z); // 建立信封左側摺線
    const envelopeRight = addBox(parent, 0.48, 0.035, 0.045, materials.postRed, x + 0.11, groundY + height + 0.23, z); // 建立信封右側摺線
    envelopeLeft.rotation.y = -0.62; // 將左摺線斜向信封中心
    envelopeRight.rotation.y = 0.62; // 將右摺線斜向信封中心
  } // 結束郵局屋頂信封圖案
  if (kind === "警察局") { // 為警察局加上徽章與警示燈
    addSphere(parent, 0.22, materials.policeBlue, x, groundY + height - 0.42, frontZ - 0.13, 8, 6); // 在警局招牌中央加上圓形警徽
    addBox(parent, 0.24, 0.16, 0.24, materials.postRed, x - 0.2, groundY + height + 0.2, z); // 在警局屋頂安裝紅色警示燈
    addBox(parent, 0.24, 0.16, 0.24, materials.policeBlue, x + 0.2, groundY + height + 0.2, z); // 在警局屋頂安裝藍色警示燈
    addBox(parent, 0.72, 0.055, 0.72, materials.schoolWall, x, groundY + height + 0.2, z - 0.48); // 在警局屋頂加上白色徽章底板
    addSphere(parent, 0.24, materials.policeBlue, x, groundY + height + 0.24, z - 0.48, 8, 6); // 在屋頂徽章底板中央加上藍色圓章
  } // 結束警察局識別設施
  if (kind === "衛生所") { // 在衛生所正面加上標誌性紅十字
    addBox(parent, 0.16, 0.58, 0.1, materials.clinicRed, x, groundY + height + 0.38, frontZ - 0.13); // 建立紅十字的垂直筆畫
    addBox(parent, 0.58, 0.16, 0.1, materials.clinicRed, x, groundY + height + 0.38, frontZ - 0.14); // 建立紅十字的水平筆畫
    addBox(parent, 0.22, 0.06, 0.82, materials.clinicRed, x, groundY + height + 0.19, z); // 在衛生所屋頂加上紅十字垂直筆畫
    addBox(parent, 0.82, 0.06, 0.22, materials.clinicRed, x, groundY + height + 0.2, z); // 在衛生所屋頂加上紅十字水平筆畫
  } // 結束衛生所紅十字標誌
} // 結束公共服務主建築建立流程
function addCivicProp(parent, label, material, x, y, z) { // 建立郵筒等公共服務街道小物件
  addBox(parent, 0.44, 0.58, 0.34, material, x, y, z); // 建立公共服務街道設備主體
  addBox(parent, 0.5, 0.08, 0.38, materials.platform, x, y + 0.33, z); // 在設備頂部加上淺色帽沿
} // 結束公共服務設備建立
function createPoliceCar(parent, x, z) { // 用方塊與圓柱建立停在警局前的巡邏車
  addBox(parent, 1.45, 0.4, 0.78, materials.cityWall, x, 1.34, z); // 建立巡邏車白色車身
  addBox(parent, 0.82, 0.36, 0.66, materials.policeBlue, x, 1.7, z); // 建立巡邏車藍色駕駛艙
  addBox(parent, 0.72, 0.1, 0.82, materials.policeBlue, x, 1.49, z); // 在車身側面加上藍色警徽條帶
  addCylinder(parent, 0.15, 0.15, 0.1, materials.metal, x - 0.48, 1.16, z + 0.38, 8); // 安裝巡邏車左前輪
  addCylinder(parent, 0.15, 0.15, 0.1, materials.metal, x + 0.48, 1.16, z + 0.38, 8); // 安裝巡邏車右前輪
  addBox(parent, 0.2, 0.12, 0.16, materials.postRed, x - 0.16, 1.94, z); // 安裝巡邏車紅色警示燈
  addBox(parent, 0.2, 0.12, 0.16, materials.policeBlue, x + 0.16, 1.94, z); // 安裝巡邏車藍色警示燈
} // 結束巡邏車建立流程
function createCityDistrict(parent, spec, cityStyle) { // 建立道路交錯且住宅密集的現代城市
  addBox(parent, spec.size - 0.7, 0.075, 0.86, materials.asphalt, 0, 0.99, 0); // 鋪設城市東西向主幹道
  addBox(parent, 0.86, 0.075, spec.size - 0.7, materials.asphalt, 0, 0.99, 0); // 鋪設城市南北向主幹道
  for (let marker = -3; marker <= 3; marker += 1) { // 沿城市道路放置短型路面標線
    addBox(parent, 0.42, 0.025, 0.075, materials.marking, marker * 0.78, 1.04, 0); // 標示東西向車道中心線
    addBox(parent, 0.075, 0.025, 0.42, materials.marking, 0, 1.04, marker * 0.78); // 標示南北向車道中心線
  } // 結束城市道路標線配置
  const lots = [-3.35, -1.25, 1.25, 3.35]; // 定義主幹道兩側的密集建築街廓
  lots.forEach((x, column) => lots.forEach((z, row) => { // 逐一建造十六棟住宅與商辦大樓
    const pattern = (row * 3 + column * 2 + cityStyle) % 5; // 計算建築外觀與樓高的變化樣式
    const height = 1.75 + pattern * 0.42; // 依街廓樣式設定建築樓高
    createCityBuilding(parent, x, z, 1.25, 1.25, height, pattern + cityStyle, false); // 建造帶有玻璃窗的城市建築
  })); // 結束十六棟城市建築配置
  createLamp(parent, -0.68, 1, -0.78); // 在城市十字路口設置路燈
  createLamp(parent, 0.68, 1, 0.78); // 在城市另一側路口設置路燈
  spawnWalker(parent, { x: -0.15, z: -1.35, radiusX: 1.45, radiusZ: 0.22, phase: cityStyle + 0.5 }, { shirtColor: cityStyle === 0 ? "#df685c" : "#548b7a", hairColor: "#3c2a23", helmet: true }); // 安排市民沿東西向道路通勤
  spawnWalker(parent, { x: 1.35, z: 0.1, radiusX: 0.22, radiusZ: 1.5, phase: cityStyle + 2.8 }, { shirtColor: cityStyle === 0 ? "#4d8caa" : "#dcaa47", hairColor: "#594034", backpack: true }); // 安排背包行人沿南北向道路行走
  spawnWalker(parent, { x: -1.35, z: 1.3, radiusX: 0.95, radiusZ: 0.18, phase: cityStyle + 4.4 }, { shirtColor: "#8a6eaa", hairColor: "#352720" }); // 安排第三位居民沿街區步道行走
} // 結束現代城市景觀配置
function createCityBuilding(parent, x, z, width, depth, height, style, isTech) { // 建造含窗格與屋頂設備的低多邊形大樓
  const groundY = 1; // 設定建築物與平台地面的接合高度
  const facade = isTech ? materials.techGlass : style % 3 === 0 ? materials.cityWarm : materials.cityWall; // 依城市類型選擇建築外牆
  const glass = isTech ? materials.techGlow : materials.window; // 依城市類型選擇窗戶玻璃
  addBox(parent, width, height, depth, facade, x, groundY + height / 2, z); // 建立建築主體方塊
  registerCollider(parent, x, z, width / 2 + 0.1, depth / 2 + 0.1); // 登記建築底部的矩形碰撞區
  addBox(parent, width + 0.1, 0.09, depth + 0.1, materials.platform, x, groundY + height + 0.045, z); // 在大樓頂端加上屋頂女兒牆
  const floors = Math.max(2, Math.floor(height / 0.78)); // 依樓高計算窗戶樓層數
  for (let floor = 0; floor < floors; floor += 1) { // 逐層安裝城市大樓窗戶
    const windowY = groundY + 0.38 + floor * 0.67; // 計算目前樓層窗戶高度
    if (windowY > groundY + height - 0.2) continue; // 避免窗戶超出建築屋頂
    for (const column of [-0.31, 0.31]) { // 在建築正面排列兩扇玻璃窗
      addWindow(parent, 0.25, 0.25, 0.035, glass, x + column, windowY, z - depth / 2 - 0.022); // 安裝建築正面窗格
      addWindow(parent, 0.035, 0.25, 0.25, glass, x + width / 2 + 0.022, windowY, z + column); // 安裝建築右側窗格
    } // 結束目前樓層窗戶排列
  } // 結束大樓窗戶樓層配置
  if (height > 2.35) addBox(parent, 0.34, 0.22, 0.32, materials.metal, x + width * 0.2, groundY + height + 0.18, z); // 在較高樓頂放置空調設備
  if (isTech) addBox(parent, 0.1, 0.42, 0.1, materials.techGlow, x, groundY + height + 0.3, z); // 在科技大樓屋頂加上發光訊號柱
} // 結束低多邊形城市建築建立
function addWindow(parent, width, height, depth, material, x, y, z) { // 建立不投射陰影的低面數玻璃窗
  const windowMesh = addBox(parent, width, height, depth, material, x, y, z); // 建立大樓窗格方塊
  windowMesh.castShadow = false; // 關閉窗格陰影以減少大量建築的繪製負擔
  windowMesh.receiveShadow = false; // 關閉窗格接收陰影以維持清楚玻璃色塊
} // 結束城市窗格建立
function createTechDistrict(parent, spec) { // 建立具有中央塔樓與能源設施的科技城
  addBox(parent, spec.size - 0.7, 0.075, 0.72, materials.asphalt, 0, 0.99, 0); // 鋪設科技城東西向道路
  addBox(parent, 0.72, 0.075, spec.size - 0.7, materials.asphalt, 0, 0.99, 0); // 鋪設科技城南北向道路
  addCylinder(parent, 1.35, 1.35, 0.09, materials.path, 0, 1.04, 0, 12); // 建立科技城中央圓形廣場
  createCityBuilding(parent, 0, 0, 1.75, 1.75, 5.8, 0, true); // 建造科技城中央高聳玻璃塔
  createCityBuilding(parent, -2.55, -2.55, 1.42, 1.42, 3.6, 1, true); // 建造科技城西南科技大樓
  createCityBuilding(parent, 2.55, -2.55, 1.42, 1.42, 3.2, 2, true); // 建造科技城東南科技大樓
  createCityBuilding(parent, -2.55, 2.55, 1.42, 1.42, 3.2, 3, true); // 建造科技城西北科技大樓
  createCityBuilding(parent, 2.55, 2.55, 1.42, 1.42, 3.7, 4, true); // 建造科技城東北科技大樓
  addCylinder(parent, 0.08, 0.08, 1.15, materials.techGlow, 0, 4.55, 0, 7); // 在中央塔頂安裝訊號天線
  addSphere(parent, 0.22, materials.techGlow, 0, 5.25, 0, 8, 6); // 在塔頂安裝發光科技球
  addBox(parent, 0.65, 0.07, 0.48, materials.techGlass, -3.35, 1.08, 0); // 在科技城西側放置太陽能板
  addBox(parent, 0.65, 0.07, 0.48, materials.techGlass, 3.35, 1.08, 0); // 在科技城東側放置太陽能板
  spawnWalker(parent, { x: -1.25, z: 0.18, radiusX: 1.05, radiusZ: 0.18, phase: 1.1 }, { shirtColor: "#42a5a0", hairColor: "#302724", helmet: true }); // 安排工程人員沿科技廣場行走
  spawnWalker(parent, { x: 0.18, z: 1.25, radiusX: 0.18, radiusZ: 1.05, phase: 3.3 }, { shirtColor: "#d77852", hairColor: "#4a3128", backpack: true }); // 安排訪客沿科技城步道行走
} // 結束科技城市景觀配置
function createCountrysideDistrict(parent, spec) { // 建立鄉村住宅、菜田與成排農作物
  addBox(parent, 0.72, 0.07, spec.size - 1.1, materials.path, -0.15, 0.99, 0); // 鋪設連接住宅與田地的鄉間小路
  addBox(parent, 3.45, 0.07, 3.35, materials.soil, 1.8, 0.99, 0.55); // 鋪設右側方形農田土壤
  for (let row = 0; row < 6; row += 1) { // 在農田中建立六列蔬菜畦
    const rowZ = -0.75 + row * 0.55; // 計算目前菜畦的位置
    addBox(parent, 3.15, 0.08, 0.13, row % 2 === 0 ? materials.cropA : materials.cropB, 1.8, 1.08, rowZ); // 種植一列低矮作物
    for (let plant = 0; plant < 7; plant += 1) { // 沿菜畦排列小型作物植株
      addBox(parent, 0.09, 0.25, 0.09, plant % 2 === 0 ? materials.cropB : materials.cropA, 0.45 + plant * 0.45, 1.22, rowZ); // 長出一株方塊農作物
    } // 結束目前菜畦的作物排列
  } // 結束六列菜畦配置
  createRuralHome(parent, -2.35, -2.1); // 在小路旁建造紅瓦鄉村住宅
  createRuralHome(parent, -2.35, 1.5, 0.72); // 在農田附近建造較小的農舍
  createTree(parent, -3.45, 1, 3.3, 0.82); // 在鄉村住宅旁種植一棵大樹
  createTree(parent, -3.5, 1, -0.15, 0.7); // 在鄉間小路旁種植第二棵樹
  addBox(parent, 0.08, 0.34, 3.4, materials.wood, -0.25, 1.14, 2.8); // 沿農田一側架設木製圍欄
  spawnWalker(parent, { x: -0.7, z: -1.75, radiusX: 0.35, radiusZ: 1.15, phase: 0.8 }, { shirtColor: "#d48646", hairColor: "#55402e", hat: false, backpack: true }); // 安排農夫沿鄉間道路行走
  spawnWalker(parent, { x: 2.15, z: 2.55, radiusX: 0.8, radiusZ: 0.28, phase: 3.7 }, { shirtColor: "#638f57", hairColor: "#5c3927", helmet: true }); // 安排農務工作者沿田埂巡田
} // 結束鄉村景觀配置
function createRuralHome(parent, x, z, scale = 1) { // 用方塊與斜屋頂組合鄉村小屋
  const home = new THREE.Group(); // 建立鄉村住宅專屬群組
  home.position.set(x, 0, z); // 將住宅移到指定田園位置
  home.scale.setScalar(scale); // 依需求縮放住宅大小
  parent.add(home); // 將住宅群組放入鄉村平台
  registerCollider(parent, x, z, 0.9 * scale, 0.84 * scale); // 登記農舍底部的矩形碰撞區
  addBox(home, 1.55, 1.1, 1.42, materials.ruralWall, 0, 1.55, 0); // 建立淺黃色住宅牆面
  const leftRoof = addBox(home, 0.92, 0.14, 1.62, materials.roof, -0.42, 2.18, 0); // 建立屋頂左側斜面
  const rightRoof = addBox(home, 0.92, 0.14, 1.62, materials.roof, 0.42, 2.18, 0); // 建立屋頂右側斜面
  leftRoof.rotation.z = -0.56; // 將左屋頂旋成斜面
  rightRoof.rotation.z = 0.56; // 將右屋頂旋成斜面
  addBox(home, 0.36, 0.72, 0.08, materials.wood, 0, 1.35, -0.76); // 安裝住宅正面的木門
  addWindow(home, 0.32, 0.3, 0.035, materials.window, -0.48, 1.72, -0.76); // 安裝住宅左側玻璃窗
  addWindow(home, 0.32, 0.3, 0.035, materials.window, 0.48, 1.72, -0.76); // 安裝住宅右側玻璃窗
  addCylinder(home, 0.13, 0.15, 0.55, materials.roof, 0.53, 2.38, 0.42, 6); // 在屋頂架設短煙囪
} // 結束鄉村住宅建立流程
function spawnWalker(parent, route, appearance) { // 在指定平台放置具有巡迴路徑的行人
  const person = makeChibi(appearance); // 依外觀設定建立低多邊形人物
  person.position.set(route.x, 1, route.z); // 將人物腳底放在平台表面
  person.scale.setScalar(0.86); // 統一角色大小並保留頭身比例
  person.userData.route = { ...route, groundY: 1 }; // 儲存橢圓步行路線與地面高度
  parent.add(person); // 將行人加入所屬平台群組
  walkers.push(person); // 登記行人供主動畫迴圈更新
  return person; // 回傳行人以便需要時調整
} // 結束行人放置流程
function createTree(parent, x, groundY, z, scale) { // 用圓柱與低面數球體拼出公園樹木
  const group = new THREE.Group(); // 建立樹木專屬群組
  group.position.set(x, groundY, z); // 將樹木底部對齊平台表面
  group.scale.setScalar(scale); // 依需求縮放整棵樹
  parent.add(group); // 將樹木群組加入平台
  registerObjectCircle(group, 0.43 * scale); // 登記樹幹與樹冠下方的圓形障礙區
  addCylinder(group, 0.13, 0.2, 1.05, materials.trunk, 0, 0.52, 0, 7); // 用圓柱建立略微收尖的樹幹
  addSphere(group, 0.74, materials.leafA, 0, 1.48, 0, 7, 5); // 用低面數球體建立樹冠主體
  addSphere(group, 0.52, materials.leafB, -0.35, 1.75, 0.08, 6, 5); // 在樹冠左上方疊加淺綠葉叢
  addSphere(group, 0.48, materials.leafA, 0.34, 1.82, -0.08, 6, 5); // 在樹冠右上方疊加深綠葉叢
  addSphere(group, 0.38, materials.leafB, 0.03, 2.08, 0.12, 6, 4); // 在樹冠頂端補上圓潤葉叢
} // 結束低多邊形樹木建立流程
function createBench(parent, x, groundY, z, rotation) { // 用方塊與圓柱建立公園長椅
  const group = new THREE.Group(); // 建立長椅專屬群組
  group.position.set(x, groundY, z); // 將長椅放在平台地面
  group.rotation.y = rotation; // 依步道方向旋轉長椅
  parent.add(group); // 將長椅群組加入平台
  addBox(group, 1.48, 0.13, 0.48, materials.wood, 0, 0.62, 0); // 建立長椅木製座面
  addBox(group, 1.48, 0.12, 0.14, materials.wood, 0, 1.02, -0.2); // 建立長椅木製椅背
  addCylinder(group, 0.055, 0.055, 0.62, materials.metal, -0.53, 0.31, -0.12, 7); // 建立左側圓柱椅腳
  addCylinder(group, 0.055, 0.055, 0.62, materials.metal, 0.53, 0.31, -0.12, 7); // 建立右側圓柱椅腳
  addBox(group, 0.12, 0.48, 0.12, materials.metal, -0.53, 0.42, 0.16); // 建立左側椅背支架
  addBox(group, 0.12, 0.48, 0.12, materials.metal, 0.53, 0.42, 0.16); // 建立右側椅背支架
} // 結束公園長椅建立流程
function createLamp(parent, x, groundY, z) { // 用圓柱與方塊建立簡潔路燈
  const group = new THREE.Group(); // 建立路燈專屬群組
  group.position.set(x, groundY, z); // 將路燈底部對齊平台地面
  parent.add(group); // 將路燈群組加入平台
  addCylinder(group, 0.055, 0.095, 1.85, materials.metal, 0, 0.93, 0, 8); // 建立深色圓柱燈柱
  addBox(group, 0.58, 0.12, 0.42, materials.metal, 0.18, 1.87, 0); // 建立向外延伸的燈具外殼
  addSphere(group, 0.18, materials.lamp, 0.18, 1.77, 0, 7, 5); // 建立柔和發光的球形燈罩
  addBox(group, 0.34, 0.07, 0.3, materials.rail, 0.18, 1.98, 0); // 在燈具頂部加上黃色裝飾帽
} // 結束路燈建立流程
function createMarineActors() { // 在島嶼間的開闊水域建立海鳥、魚群與小船
  createSeaBird(-8.2, -3.2, 0.4); // 在西北側海面上安排第一隻盤旋海鳥
  createSeaBird(8.1, -7.0, 2.2); // 在東北側海面上安排第二隻盤旋海鳥
  createSeaBird(-3.8, 9.0, 4.1); // 在南側海面上安排第三隻盤旋海鳥
  createFish(6.1, -6.8, "#f2bd52", 0.9, 0.2); // 在東北水域放入第一條游魚
  createFish(6.8, -6.45, "#4d9eae", 0.78, 1.1); // 在第一條游魚旁加入同伴
  createFish(5.45, -7.1, "#e67c58", 0.72, 2.4); // 加入橘色魚形成小魚群
  createFish(-6.1, 6.7, "#f2bd52", 0.86, 3.2); // 在西南水域放入第二群魚
  createFish(-6.8, 7.05, "#4d9eae", 0.76, 4.4); // 加入第二群魚的藍綠色同伴
  createBoat(7.0, 7.1, 1.3); // 在東南水域放置一艘緩慢漂行的小船
} // 結束海洋生物與船隻建立
function createSeaBird(x, z, phase) { // 用低面數身體與兩翼建立一隻海鳥
  const bird = new THREE.Group(); // 建立海鳥動畫群組
  const feather = new THREE.MeshStandardMaterial({ color: "#f5f4e9", roughness: 0.88, flatShading: true }); // 建立海鳥羽毛材質
  const beak = new THREE.MeshStandardMaterial({ color: "#e9954d", roughness: 0.85 }); // 建立海鳥喙部材質
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), feather); // 建立白色低多邊形鳥身
  body.scale.set(1.25, 0.55, 0.72); // 將鳥身拉成輕巧的飛行輪廓
  bird.add(body); // 將鳥身加入海鳥群組
  const leftWing = addBox(bird, 0.52, 0.055, 0.2, feather, -0.3, 0.015, 0); // 建立海鳥左側翅膀
  const rightWing = addBox(bird, 0.52, 0.055, 0.2, feather, 0.3, 0.015, 0); // 建立海鳥右側翅膀
  addBox(bird, 0.13, 0.085, 0.12, beak, 0, -0.025, -0.24); // 在鳥身前方加上橘色短喙
  bird.position.set(x, 6.2, z); // 將海鳥放在島嶼上方的空中
  bird.userData.flight = { x, z, phase, leftWing, rightWing }; // 記錄海鳥巡飛路徑與翅膀關節
  scene.add(bird); // 將海鳥加入 3D 場景
  seaBirds.push(bird); // 登記海鳥供每影格更新
} // 結束海鳥模型建立
function createFish(x, z, color, scale, phase) { // 建立一條在水面下方游動的低多邊形魚
  const fish = new THREE.Group(); // 建立魚群成員的動畫群組
  const fishMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.58, flatShading: true }); // 建立魚身彩色材質
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5), fishMaterial); // 建立魚身橢圓球體
  body.scale.set(0.72, 0.28, 1); // 將魚身壓扁並沿游泳方向拉長
  fish.add(body); // 將魚身加入魚群成員
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 4), fishMaterial); // 建立三角形魚尾
  tail.rotation.x = Math.PI / 2; // 將魚尾旋轉至水面平面
  tail.position.z = 0.28; // 將魚尾接在魚身後端
  fish.add(tail); // 將魚尾加入魚身
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), materials.eye); // 建立魚頭深色小眼睛
  eye.position.set(-0.1, 0.06, -0.17); // 將眼睛放在魚頭前側
  fish.add(eye); // 將魚眼加入魚身
  fish.scale.setScalar(scale); // 依魚種設定魚身大小
  fish.position.set(x, -0.075, z); // 將魚群放在海面下方的可見水層
  fish.userData.swim = { x, z, phase }; // 記錄魚群中心與游動相位
  scene.add(fish); // 將游魚加入 3D 場景
  fishSchools.push(fish); // 登記游魚供每影格更新
} // 結束游魚建立
function createBoat(x, z, phase) { // 用木船身、座艙與小桅杆建立海面小船
  const boat = new THREE.Group(); // 建立小船漂流群組
  addBox(boat, 1.65, 0.22, 0.78, materials.wood, 0, 0, 0); // 建立深木色船身
  addBox(boat, 0.72, 0.42, 0.55, materials.schoolWall, -0.18, 0.28, 0.02); // 建立淺色小船座艙
  addBox(boat, 0.76, 0.09, 0.6, materials.policeBlue, -0.18, 0.53, 0.02); // 在座艙屋頂加上藍色頂棚
  addCylinder(boat, 0.035, 0.035, 0.76, materials.metal, 0.48, 0.42, 0, 6); // 在船身中央架設短桅杆
  addBox(boat, 0.38, 0.48, 0.04, materials.schoolWall, 0.65, 0.63, 0); // 在桅杆旁掛上白色小帆
  boat.position.set(x, -0.08, z); // 將小船放在島嶼間的海面上
  boat.userData.drift = { x, z, phase }; // 記錄船隻漂流中心與相位
  scene.add(boat); // 將小船加入 3D 場景
  boats.push(boat); // 登記船隻供每影格更新
} // 結束小船建立
function updateWaterWaves(elapsed) { // 以低幅度雙向波形更新細分海面頂點
  const positions = water.geometry.attributes.position; // 取得海面頂點座標緩衝
  for (let index = 0; index < positions.count; index += 1) { // 逐一更新海面網格頂點
    const worldX = positions.getX(index); // 取得頂點的水平世界座標
    const worldZ = -positions.getY(index); // 將平面區域座標換算成世界深度座標
    const wave = Math.sin(worldX * 0.24 + worldZ * 0.17 + elapsed * 0.8) * 0.035 + Math.sin(worldZ * 0.42 - worldX * 0.13 - elapsed * 0.56) * 0.018; // 混合兩道柔和的行進波
    positions.setZ(index, wave); // 將小幅波浪高度寫回海面頂點
  } // 結束所有海面頂點更新
  positions.needsUpdate = true; // 通知 Three.js 更新頂點緩衝
  water.geometry.computeVertexNormals(); // 重算平滑波面光照法線
} // 結束自然海浪更新
function updateMarineLife(elapsed) { // 更新海鳥翅膀、魚群游動與小船漂浮
  for (const bird of seaBirds) { // 逐一更新空中的海鳥
    const flight = bird.userData.flight; // 讀取海鳥巡飛路徑與翅膀群組
    bird.position.x = flight.x + Math.sin(elapsed * 0.22 + flight.phase) * 1.15; // 讓海鳥沿水平方向緩慢盤旋
    bird.position.z = flight.z + Math.cos(elapsed * 0.19 + flight.phase) * 0.8; // 讓海鳥沿深度方向繞行
    bird.position.y = 6.2 + Math.sin(elapsed * 1.8 + flight.phase) * 0.12; // 加入海鳥輕微上下飛行起伏
    flight.leftWing.rotation.z = Math.sin(elapsed * 7 + flight.phase) * 0.32; // 讓左翼規律拍動
    flight.rightWing.rotation.z = -Math.sin(elapsed * 7 + flight.phase) * 0.32; // 讓右翼反向拍動
  } // 結束海鳥動態更新
  for (const fish of fishSchools) { // 逐一更新水面下方的魚群
    const swim = fish.userData.swim; // 讀取魚群巡游路徑
    fish.position.x = swim.x + Math.sin(elapsed * 0.72 + swim.phase) * 0.58; // 讓游魚左右擺動前進
    fish.position.z = swim.z + Math.cos(elapsed * 0.58 + swim.phase) * 0.38; // 讓游魚在水域中緩慢轉向
    fish.rotation.y = Math.sin(elapsed * 0.58 + swim.phase) * 0.24; // 讓魚身順著群游方向微微偏轉
  } // 結束魚群游動更新
  for (const boat of boats) { // 逐一更新海面上的小船
    const drift = boat.userData.drift; // 讀取船隻漂流中心與相位
    boat.position.x = drift.x + Math.sin(elapsed * 0.12 + drift.phase) * 0.5; // 讓小船緩慢橫向漂移
    boat.position.z = drift.z + Math.cos(elapsed * 0.1 + drift.phase) * 0.32; // 讓小船隨海流前後漂移
    boat.position.y = -0.08 + Math.sin(elapsed * 1.15 + drift.phase) * 0.035; // 讓小船隨海浪輕輕起伏
    boat.rotation.y = Math.sin(elapsed * 0.1 + drift.phase) * 0.12; // 讓船頭隨水流微幅轉向
  } // 結束小船漂流更新
} // 結束海洋生物動畫更新
function makeChibi(parameters = {}) { // 依外觀參數建立球頭與膠囊身體的低多邊形人物
  const person = new THREE.Group(); // 建立人物根群組供定位與旋轉
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: parameters.shirtColor ?? "#4d91a1", roughness: 0.88 }); // 依參數設定人物上衣顏色
  const hairMaterial = new THREE.MeshStandardMaterial({ color: parameters.hairColor ?? "#493126", roughness: 0.95 }); // 依參數設定人物頭髮顏色
  const headY = 1.42; // 設定球形頭部中心高度
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.36, 4, 8), shirtMaterial); // 建立總高零點七二的膠囊上衣身體
  body.position.y = 0.82; // 將身體放在骨盆與頭部之間
  body.castShadow = true; // 讓人物身體投射柔和陰影
  body.receiveShadow = true; // 讓人物身體承接場景陰影
  person.add(body); // 將膠囊身體加入人物根群組
  addSphere(person, 0.24, materials.skin, 0, headY, 0, 9, 7); // 用球體建立頭身比約一比一點五的頭部
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMaterial); // 建立覆蓋頭頂的低面數髮帽
  hair.position.set(0, headY + 0.025, 0); // 將髮帽貼合球形頭部上緣
  hair.castShadow = true; // 讓頭髮投射柔和陰影
  person.add(hair); // 將頭髮加入人物根群組
  if (parameters.hairStyle === "長髮") { // 依設定為人物增加後側長髮
    const longHair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), hairMaterial); // 建立低多邊數後側髮束
    longHair.position.set(0, headY - 0.18, 0.12); // 將長髮放在頭部後方
    longHair.scale.set(0.9, 1.1, 0.72); // 將髮束拉長覆蓋後腦
    person.add(longHair); // 將長髮加入人物根群組
  } else if (parameters.hairStyle === "蓬鬆") { // 依設定為人物增加蓬鬆髮頂
    addSphere(person, 0.16, hairMaterial, 0, headY + 0.19, 0.02, 7, 5); // 在頭頂加上一束圓潤髮型
  } // 結束髮型樣式設定
  addSphere(person, 0.04, materials.eye, -0.085, headY + 0.015, -0.218, 7, 5); // 在臉部左側安裝圓形眼睛
  addSphere(person, 0.04, materials.eye, 0.085, headY + 0.015, -0.218, 7, 5); // 在臉部右側安裝圓形眼睛
  addSphere(person, 0.025, materials.eye, 0, headY - 0.095, -0.231, 6, 4); // 在臉部中央點出簡單嘴巴
  if (parameters.helmet) { // 依參數決定是否替人物戴上安全帽
    const helmetMaterial = new THREE.MeshStandardMaterial({ color: parameters.helmetColor ?? "#f2c84b", roughness: 0.64 }); // 建立可設定顏色的安全帽材質
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMaterial); // 建立圓潤低面數安全帽帽殼
    helmet.position.set(0, headY + 0.045, 0); // 將安全帽帽殼放在頭頂
    helmet.castShadow = true; // 讓安全帽投射陰影
    person.add(helmet); // 將安全帽帽殼加入人物
    addBox(person, 0.58, 0.055, 0.34, helmetMaterial, 0, headY + 0.025, -0.015); // 在安全帽前方加上帽簷
  } // 結束安全帽外觀設定
  if (parameters.hat) { // 依參數決定是否替人物戴上有帽簷的帽子
    const hatMaterial = new THREE.MeshStandardMaterial({ color: parameters.hatColor ?? "#347db8", roughness: 0.76 }); // 建立可設定顏色的布帽材質
    addCylinder(person, 0.19, 0.21, 0.2, hatMaterial, 0, headY + 0.2, 0, 9); // 在頭頂建立帽冠
    addCylinder(person, 0.34, 0.34, 0.055, hatMaterial, 0, headY + 0.105, 0, 10); // 在帽冠下方加上寬帽簷
  } // 結束帽子外觀設定
  if (parameters.backpack) { // 依參數決定是否替人物背上背包
    const backpackMaterial = new THREE.MeshStandardMaterial({ color: parameters.backpackColor ?? "#456d5c", roughness: 0.88 }); // 建立可設定顏色的背包材質
    addBox(person, 0.34, 0.42, 0.2, backpackMaterial, 0, 0.83, 0.245); // 在人物背後安裝方形背包
    addBox(person, 0.075, 0.44, 0.055, backpackMaterial, -0.13, 0.84, 0.11); // 加上背包左側肩帶
    addBox(person, 0.075, 0.44, 0.055, backpackMaterial, 0.13, 0.84, 0.11); // 加上背包右側肩帶
  } // 結束背包外觀設定
  const leftArm = new THREE.Group(); // 建立左肩關節群組
  leftArm.position.set(-0.23, 1.07, 0); // 將左肩關節接到身體左側
  person.add(leftArm); // 將左手臂掛接在人物根群組
  const leftUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.27, 4, 7), shirtMaterial); // 建立左側膠囊上臂
  leftUpperArm.position.y = -0.18; // 將左上臂垂掛在肩關節下方
  leftUpperArm.castShadow = true; // 讓左上臂投射柔和陰影
  leftArm.add(leftUpperArm); // 將左上臂掛接在左肩關節
  addSphere(leftArm, 0.067, materials.skin, 0, -0.38, -0.005, 7, 5); // 在左手臂末端接上手掌
  const rightArm = new THREE.Group(); // 建立右肩關節群組
  rightArm.position.set(0.23, 1.07, 0); // 將右肩關節接到身體右側
  person.add(rightArm); // 將右手臂掛接在人物根群組
  const rightUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.27, 4, 7), shirtMaterial); // 建立右側膠囊上臂
  rightUpperArm.position.y = -0.18; // 將右上臂垂掛在肩關節下方
  rightUpperArm.castShadow = true; // 讓右上臂投射柔和陰影
  rightArm.add(rightUpperArm); // 將右上臂掛接在右肩關節
  addSphere(rightArm, 0.067, materials.skin, 0, -0.38, -0.005, 7, 5); // 在右手臂末端接上手掌
  const leftLeg = new THREE.Group(); // 建立左髖關節群組
  leftLeg.position.set(-0.115, 0.48, 0); // 將左髖關節接到身體左下方
  person.add(leftLeg); // 將左腿掛接在人物根群組
  const leftLowerLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.073, 0.34, 4, 7), materials.pants); // 建立左側膠囊長褲與小腿
  leftLowerLeg.position.y = -0.235; // 將左腿向下接近地面
  leftLowerLeg.castShadow = true; // 讓左腿投射柔和陰影
  leftLeg.add(leftLowerLeg); // 將左腿掛接在左髖關節
  const leftFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.13, 3, 6), materials.metal); // 建立左腳的短膠囊鞋子
  leftFoot.rotation.x = Math.PI / 2; // 將左腳旋成朝前的鞋型
  leftFoot.position.set(0, -0.45, -0.045); // 將左腳接在左腿底端
  leftLeg.add(leftFoot); // 將左腳掛接在左髖關節
  const rightLeg = new THREE.Group(); // 建立右髖關節群組
  rightLeg.position.set(0.115, 0.48, 0); // 將右髖關節接到身體右下方
  person.add(rightLeg); // 將右腿掛接在人物根群組
  const rightLowerLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.073, 0.34, 4, 7), materials.pants); // 建立右側膠囊長褲與小腿
  rightLowerLeg.position.y = -0.235; // 將右腿向下接近地面
  rightLowerLeg.castShadow = true; // 讓右腿投射柔和陰影
  rightLeg.add(rightLowerLeg); // 將右腿掛接在右髖關節
  const rightFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.13, 3, 6), materials.metal); // 建立右腳的短膠囊鞋子
  rightFoot.rotation.x = Math.PI / 2; // 將右腳旋成朝前的鞋型
  rightFoot.position.set(0, -0.45, -0.045); // 將右腳接在右腿底端
  rightLeg.add(rightFoot); // 將右腳掛接在右髖關節
  person.userData.walkJoints = { leftArm, rightArm, leftLeg, rightLeg }; // 保存手腳關節供步行動畫控制
  person.userData.walkBaseY = 1; // 設定角色站立時的地面高度
  return person; // 回傳可自行定位與動畫化的人物群組
} // 結束可設定外觀的人物建立函式
function animateWalk0(person, elapsed, phase = 0) { // 以正弦波驅動人物手腳交替前後擺動
  const joints = person.userData.walkJoints; // 讀取人物的肩關節與髖關節群組
  if (!joints) return; // 略過未使用 makeChibi 建立的物件
  const swing = Math.sin(elapsed * 5.2 + phase) * 0.58; // 依經過時間計算左右腳步擺幅
  joints.leftArm.rotation.x = swing; // 讓左手臂與右腿反向擺動
  joints.rightArm.rotation.x = -swing; // 讓右手臂與左腿反向擺動
  joints.leftLeg.rotation.x = -swing; // 讓左腿向前後擺動
  joints.rightLeg.rotation.x = swing; // 讓右腿向前後擺動
  person.position.y = (person.userData.route?.groundY ?? person.userData.walkBaseY) + Math.abs(Math.sin(elapsed * 10.4 + phase)) * 0.025; // 加入輕微步行起伏並維持腳底高度
} // 結束正弦波行走動畫函式
function updateWalkerRoutes(elapsed) { // 讓人物沿各平台上的橢圓步道持續移動
  for (const person of walkers) { // 逐一更新公園與城市中的行人
    const route = person.userData.route; // 讀取人物所屬平台的巡迴路徑
    const angle = elapsed * (route.speed ?? 0.36) + route.phase; // 計算人物目前的步道相位
    person.position.x = route.x + Math.cos(angle) * route.radiusX; // 沿路線更新人物水平位置
    person.position.z = route.z + Math.sin(angle) * route.radiusZ; // 沿路線更新人物深度位置
    const velocityX = -Math.sin(angle) * route.radiusX; // 計算人物路徑切線的水平分量
    const velocityZ = Math.cos(angle) * route.radiusZ; // 計算人物路徑切線的深度分量
    person.rotation.y = Math.atan2(-velocityX, -velocityZ); // 讓人物正面朝著目前行走方向
    animateWalk0(person, elapsed, route.phase); // 同步擺動人物手腳並微調身體起伏
  } // 結束所有行人的路線更新
} // 結束平台行人路線動畫
function createBridge(from, to) { // 在相鄰平台之間建立帶黃色欄杆的橋
  const alongX = from.z === to.z; // 判斷橋梁是否沿著 X 軸延伸
  const direction = alongX ? Math.sign(to.x - from.x) : Math.sign(to.z - from.z); // 計算橋梁延伸方向
  const startInset = from.size / 2; // 設定橋梁離開起點平台的邊緣位置
  const endInset = to.size / 2; // 設定橋梁進入終點平台的邊緣位置
  const length = Math.abs(alongX ? to.x - from.x : to.z - from.z) - startInset - endInset + 0.16; // 計算兩座平台之間的橋面長度
  const deckLength = length + 0.8; // 將實體橋板延伸至兩端平台內側的安全步行區
  const centerAlong = startInset + length / 2 - 0.08; // 計算橋梁中心相對起點平台的位置
  const centerX = from.x + (alongX ? direction * centerAlong : 0); // 計算橋梁中心的 X 座標
  const centerZ = from.z + (alongX ? 0 : direction * centerAlong); // 計算橋梁中心的 Z 座標
  const bridgeWidth = 1.52; // 設定行人橋梁的通行寬度
  const deckMaterial = new THREE.MeshStandardMaterial({ color: "#d8d1b9", roughness: 0.84 }); // 建立橋面木石混合質感材質
  if (alongX) { // 建立沿東西方向延伸的橋面
    addBox(park, deckLength, 0.2, bridgeWidth, deckMaterial, centerX, 0.99, centerZ); // 放置延伸至平台內側的東西向橋面
  } else { // 建立沿南北方向延伸的橋面
    addBox(park, bridgeWidth, 0.2, deckLength, deckMaterial, centerX, 0.99, centerZ); // 放置延伸至平台內側的南北向橋面
  } // 結束橋面方向判斷
  registerWalkableRect(centerX, centerZ, alongX ? deckLength : bridgeWidth, alongX ? bridgeWidth : deckLength, 1.1, "bridge"); // 依實體延伸橋板登記安全步行區
  const railOffsets = [-bridgeWidth / 2, bridgeWidth / 2]; // 設定橋梁左右兩側欄杆的位置
  for (const railOffset of railOffsets) { // 分別建立橋梁兩側的欄杆
    const postCount = Math.max(2, Math.floor(deckLength / 0.72)); // 依實體橋板長度計算欄杆立柱數量
    for (let index = 0; index <= postCount; index += 1) { // 沿橋面均勻排列黃色欄杆立柱
      const progress = index / postCount - 0.5; // 計算目前立柱沿橋面的比例位置
      const postX = centerX + (alongX ? progress * deckLength : railOffset); // 計算立柱的 X 座標
      const postZ = centerZ + (alongX ? railOffset : progress * deckLength); // 計算立柱的 Z 座標
      addBox(park, 0.12, 0.78, 0.12, materials.rail, postX, 1.47, postZ); // 建立一根黃色方形欄杆立柱
    } // 結束目前一側立柱排列
    if (alongX) { // 建立東西向橋梁的水平欄杆
      addBox(park, deckLength, 0.12, 0.12, materials.rail, centerX, 1.77, centerZ + railOffset); // 在橋梁外側加上延伸黃色上欄杆
      addBox(park, deckLength, 0.1, 0.1, materials.rail, centerX, 1.43, centerZ + railOffset); // 在橋梁外側加上延伸黃色中欄杆
    } else { // 建立南北向橋梁的水平欄杆
      addBox(park, 0.12, 0.12, deckLength, materials.rail, centerX + railOffset, 1.77, centerZ); // 在橋梁外側加上延伸黃色上欄杆
      addBox(park, 0.1, 0.1, deckLength, materials.rail, centerX + railOffset, 1.43, centerZ); // 在橋梁外側加上延伸黃色中欄杆
    } // 結束水平欄杆方向判斷
  } // 結束橋梁兩側欄杆建立
} // 結束橋梁建立流程
const platformGroups = []; // 儲存五座平台群組供集章點與路徑使用
for (const spec of platformSpecs) { // 逐一建立五座方形浮島平台
  platformGroups.push(createPlatform(spec)); // 建立平台並保存其場景群組
} // 結束五座平台建立
for (let index = 1; index < platformSpecs.length; index += 1) { // 逐一連接四座外圍平台與中央平台
  createBridge(platformSpecs[0], platformSpecs[index]); // 建立中央廣場通往外圍的黃色欄杆橋
} // 結束四座橋梁建立
function createStampSite(parent, x, z, name, description) { // 建立地面橘色集章環與 p5 標籤錨點
  const seaLifeIndex = stampSites.length; // 依地點順序選擇不同海洋生物圖案
  const markerAnchor = new THREE.Object3D(); // 建立供 p5 平面印章投影使用的地面錨點
  markerAnchor.position.set(x, 1.02, z); // 將印章中心放在平台表面上方
  parent.add(markerAnchor); // 將印章錨點加入所屬平台
  const labelAnchor = new THREE.Object3D(); // 建立供螢幕標籤投影使用的 3D 錨點
  labelAnchor.position.set(x, 2.45, z); // 將標籤錨點設在集章環上方
  parent.add(labelAnchor); // 將標籤錨點加入所屬平台
  const worldPosition = parent.localToWorld(new THREE.Vector3(x, 1, z)); // 將集章目標轉換成世界座標
  const site = { name, description, markerAnchor, labelAnchor, x: worldPosition.x, z: worldPosition.z, groundY: 1, platformIndex: platformGroups.indexOf(parent), seaLifeIndex, radius: 0.78, markerX: 0, markerY: 0, markerVisible: false, markerSize: 36, screenX: 0, screenY: 0, labelWidth: 0, labelVisible: false, collected: false }; // 儲存平面印章、圖案、島別與標籤狀態
  stampSites.push(site); // 登記集章點供介面和角色更新使用
  return site; // 回傳集章點以便其他功能使用
} // 結束集章點建立流程
function createSeaLifeStamp(parent, x, z, type) { // 用扁平低多邊形零件建立五種海洋生物印章
  const stamp = new THREE.Group(); // 建立海洋生物印章專屬群組
  stamp.position.set(x, 1.04, z); // 將海洋生物圖案放在橘色集章環中央
  parent.add(stamp); // 將海洋生物印章放進所屬平台
  const ink = new THREE.MeshStandardMaterial({ color: "#ef843e", roughness: 0.78, flatShading: true }); // 建立橘色印章主體材質
  const lightInk = new THREE.MeshStandardMaterial({ color: "#fff0d5", roughness: 0.78, flatShading: true }); // 建立奶油白印章細節材質
  const darkInk = new THREE.MeshStandardMaterial({ color: "#3e5a5a", roughness: 0.82, flatShading: true }); // 建立深色印章眼睛與紋路
  if (type === 0) { // 建立第一枚海龜印章
    const shell = addSphere(stamp, 0.37, ink, 0, 0.08, 0, 9, 6); // 建立海龜橢圓龜殼
    shell.scale.set(1, 0.22, 0.72); // 將龜殼壓扁成地面圖章形狀
    addSphere(stamp, 0.14, lightInk, 0, 0.08, -0.34, 7, 5); // 在龜殼前端加上海龜頭部
    for (const [flipperX, flipperZ] of [[-0.31,-0.23],[0.31,-0.23],[-0.31,0.23],[0.31,0.23]]) { // 設定海龜的四片鰭腳位置
      const flipper = addSphere(stamp, 0.15, lightInk, flipperX, 0.045, flipperZ, 7, 5); // 建立一片橢圓形鰭腳
      flipper.scale.set(0.78, 0.16, 1.2); // 將鰭腳拉長成海龜肢體形狀
    } // 結束海龜鰭腳配置
    addSphere(stamp, 0.035, darkInk, -0.055, 0.18, -0.45, 6, 4); // 點出海龜的眼睛
  } else if (type === 1) { // 建立第二枚熱帶魚印章
    const body = addSphere(stamp, 0.38, lightInk, -0.04, 0.08, 0, 9, 6); // 建立魚身橢圓主體
    body.scale.set(0.9, 0.2, 0.72); // 將魚身壓扁成側面剪影
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.42, 3), ink); // 建立魚尾三角形尾鰭
    tail.rotation.x = Math.PI / 2; // 將魚尾旋轉至水平面
    tail.position.set(0, 0.08, 0.38); // 將魚尾接在魚身後端
    stamp.add(tail); // 將尾鰭加入魚身
    addSphere(stamp, 0.045, darkInk, -0.19, 0.18, -0.28, 6, 4); // 點出魚頭的圓形眼睛
    addBox(stamp, 0.38, 0.04, 0.06, ink, -0.03, 0.19, 0.02); // 在魚身上加上一道裝飾魚鱗線
  } else if (type === 2) { // 建立第三枚螃蟹印章
    const shell = addSphere(stamp, 0.31, ink, 0, 0.07, 0, 9, 6); // 建立螃蟹圓扁的身體
    shell.scale.set(1.15, 0.22, 0.72); // 將蟹身橫向展開
    for (const side of [-1, 1]) { // 在螃蟹兩側建立螯與蟹腳
      addSphere(stamp, 0.12, lightInk, side * 0.39, 0.08, -0.18, 7, 5); // 建立一隻淺色蟹螯
      for (let leg = 0; leg < 3; leg += 1) { // 在每側建立三條扁平蟹腳
        const legShape = addBox(stamp, 0.055, 0.045, 0.3, ink, side * 0.31, 0.035, -0.02 + leg * 0.16); // 建立一條小蟹腳
        legShape.rotation.y = side * 0.38; // 將蟹腳向外張開
      } // 結束單側蟹腳配置
    } // 結束螃蟹兩側造型
    addSphere(stamp, 0.035, darkInk, -0.09, 0.19, -0.2, 6, 4); // 點出螃蟹左眼
    addSphere(stamp, 0.035, darkInk, 0.09, 0.19, -0.2, 6, 4); // 點出螃蟹右眼
  } else if (type === 3) { // 建立第四枚小鯨魚印章
    const body = addSphere(stamp, 0.4, lightInk, 0, 0.08, 0, 9, 6); // 建立鯨魚圓潤的身體
    body.scale.set(0.9, 0.23, 0.76); // 將鯨魚身體壓扁成剪影
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 4), ink); // 建立鯨魚的尾鰭
    tail.rotation.x = Math.PI / 2; // 將尾鰭旋轉至水平面
    tail.position.set(0, 0.08, 0.4); // 將尾鰭放在鯨魚身體後端
    stamp.add(tail); // 將尾鰭加入鯨魚圖案
    const dorsal = addSphere(stamp, 0.13, ink, 0, 0.19, 0.02, 7, 5); // 建立鯨魚背鰭
    dorsal.scale.set(0.6, 0.55, 0.48); // 將背鰭縮成小型三角丘
    addSphere(stamp, 0.035, darkInk, -0.17, 0.2, -0.26, 6, 4); // 點出鯨魚的眼睛
  } else { // 建立第五枚章魚印章
    const head = addSphere(stamp, 0.31, ink, 0, 0.12, -0.08, 9, 6); // 建立章魚圓圓的頭部
    head.scale.set(0.82, 0.38, 0.85); // 將頭部壓扁成地面圖案
    for (let arm = 0; arm < 6; arm += 1) { // 繞著頭部建立六條章魚觸手
      const angle = arm / 6 * Math.PI * 2; // 計算目前觸手的放射角度
      const tentacle = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 3, 6), lightInk); // 建立一條短膠囊觸手
      tentacle.rotation.set(Math.PI / 2, angle, 0); // 將觸手旋轉至地面並朝外伸展
      tentacle.position.set(Math.cos(angle) * 0.27, 0.045, Math.sin(angle) * 0.27); // 將觸手沿頭部周圍排列
      stamp.add(tentacle); // 將觸手加入章魚身體
    } // 結束章魚觸手配置
    addSphere(stamp, 0.035, darkInk, -0.09, 0.31, -0.28, 6, 4); // 點出章魚左眼
    addSphere(stamp, 0.035, darkInk, 0.09, 0.31, -0.28, 6, 4); // 點出章魚右眼
  } // 結束海洋生物印章造型判斷
} // 結束地面海洋生物印章建立
function drawSeaCreatureIcon(p, type, x, y, size, color) { // 用 p5 繪製海洋生物標籤圖示
  p.push(); // 保存目前 p5 繪圖狀態
  p.translate(x, y); // 將生物圖示原點移至白色標籤圓點
  p.noStroke(); // 移除圖示零件外框
  p.fill(color); // 設定海洋生物剪影顏色
  if (type === 0) { // 繪製海龜剪影
    p.ellipse(0, 0, size * 0.55, size * 0.4); // 繪製海龜圓甲
    p.ellipse(-size * 0.34, 0, size * 0.22, size * 0.2); // 繪製海龜頭部
    p.ellipse(-size * 0.16, -size * 0.23, size * 0.24, size * 0.14); // 繪製海龜上側鰭腳
    p.ellipse(size * 0.12, -size * 0.23, size * 0.24, size * 0.14); // 繪製海龜另一側上鰭腳
    p.ellipse(-size * 0.16, size * 0.23, size * 0.24, size * 0.14); // 繪製海龜下側鰭腳
    p.ellipse(size * 0.12, size * 0.23, size * 0.24, size * 0.14); // 繪製海龜另一側下鰭腳
  } else if (type === 1) { // 繪製魚形剪影
    p.ellipse(-size * 0.05, 0, size * 0.58, size * 0.38); // 繪製魚身
    p.triangle(size * 0.2, -size * 0.18, size * 0.48, 0, size * 0.2, size * 0.18); // 繪製魚尾
    p.fill("#263b42"); // 設定魚眼睛為深色
    p.circle(-size * 0.22, -size * 0.04, size * 0.09); // 點出魚眼
  } else if (type === 2) { // 繪製螃蟹剪影
    p.ellipse(0, 0, size * 0.52, size * 0.36); // 繪製螃蟹身體
    p.ellipse(-size * 0.37, -size * 0.2, size * 0.2, size * 0.2); // 繪製螃蟹左螯
    p.ellipse(size * 0.37, -size * 0.2, size * 0.2, size * 0.2); // 繪製螃蟹右螯
    p.stroke(color); // 設定螃蟹腳線條顏色
    p.strokeWeight(Math.max(1.5, size * 0.08)); // 設定螃蟹腳線條粗細
    for (const side of [-1, 1]) for (let leg = -1; leg <= 1; leg += 1) p.line(side * size * 0.2, leg * size * 0.08, side * size * 0.43, leg * size * 0.16); // 畫出螃蟹兩側的細腳
  } else if (type === 3) { // 繪製小鯨魚剪影
    p.ellipse(-size * 0.04, 0, size * 0.7, size * 0.42); // 繪製鯨魚圓潤身體
    p.triangle(size * 0.22, -size * 0.08, size * 0.48, -size * 0.25, size * 0.4, 0); // 繪製鯨魚尾鰭
    p.triangle(-size * 0.05, -size * 0.12, size * 0.08, -size * 0.36, size * 0.16, -size * 0.1); // 繪製鯨魚背鰭
    p.fill("#263b42"); // 設定鯨魚眼睛為深色
    p.circle(-size * 0.26, -size * 0.04, size * 0.08); // 點出鯨魚眼睛
  } else { // 繪製章魚剪影
    p.ellipse(0, -size * 0.1, size * 0.48, size * 0.42); // 繪製章魚圓頭
    p.stroke(color); // 設定章魚觸手線條顏色
    p.strokeWeight(Math.max(1.5, size * 0.08)); // 設定章魚觸手線條粗細
    for (let arm = 0; arm < 5; arm += 1) p.line((arm - 2) * size * 0.12, size * 0.08, (arm - 2) * size * 0.18, size * 0.42); // 畫出章魚五條短觸手
  } // 結束 p5 海洋生物圖示判斷
  p.pop(); // 還原 p5 繪圖狀態
} // 結束海洋生物標籤圖示繪製
createStampSite(platformGroups[0], 0, -1.1, "中央校園", "教學大樓、操場與綠蔭步道，記錄校園裡的日常風景。"); // 在中央學校前庭設置第一個集章點
createStampSite(platformGroups[1], 0, 0, "便利商店", "綠色招牌亮起，街坊隨時都能補給生活所需。"); // 在東側便利商店街口設置第二個集章點
createStampSite(platformGroups[2], 0, 0, "郵局", "紅色郵筒與郵局窗口，連起每一封寄出的心意。"); // 在西側郵局廣場設置第三個集章點
createStampSite(platformGroups[3], 0, 0, "警察局", "藍白警徽守護街區，巡邏車隨時準備出勤。"); // 在北側警察局前庭設置第四個集章點
createStampSite(platformGroups[4], 0, 0, "衛生所", "紅十字指引健康服務，照顧島上居民的日常。"); // 在南側衛生所廣場設置第五個集章點
player = makeChibi({ shirtColor: "#e4674f", hairColor: "#493126", backpack: true }); // 建立供使用者控制的橘衣背包公仔
player.scale.setScalar(1.05); // 將主角放大以方便在地圖上辨識
player.position.set(-0.2, 1, 0.4); // 將主角放在中央公園的主步道
player.userData.displayName = "旅人"; // 設定主角預設姓名標籤
scene.add(player); // 將可操作主角加入 3D 場景
createMarineActors(); // 在周邊海面建立海鳥、魚群與漂流小船
let cameraAngle = 0.66; // 設定攝影機初始水平方位角
let cameraElevation = 0.76; // 設定攝影機初始俯視仰角
const minCameraElevation = THREE.MathUtils.degToRad(20); // 設定鏡頭最低俯角為二十度
const maxCameraElevation = THREE.MathUtils.degToRad(70); // 設定鏡頭最高俯角為七十度
let cameraZoom = 1; // 設定攝影機預設縮放倍率
const cameraRadius = 31; // 設定攝影機環繞公園的固定距離
function updateCamera() { // 依目前視角參數更新正交攝影機位置
  camera.position.set(cameraFocus.x + cameraRadius * Math.cos(cameraElevation) * Math.sin(cameraAngle), cameraFocus.y + cameraRadius * Math.sin(cameraElevation), cameraFocus.z + cameraRadius * Math.cos(cameraElevation) * Math.cos(cameraAngle)); // 計算跟隨焦點的斜俯視攝影機位置
  camera.lookAt(cameraFocus); // 讓攝影機持續看向平滑更新的主角焦點
  camera.zoom = cameraZoom; // 將目前縮放倍率套用到正交攝影機
  camera.updateProjectionMatrix(); // 更新攝影機投影矩陣
} // 結束攝影機位置更新
updateCamera(); // 套用預設右上方斜俯視角度
function updateCameraFollow(deltaSeconds) { // 以指數平滑插值跟隨主角位置
  if (!player || !cameraFollowEnabled) return; // 主角不存在或自由視角時停止鏡頭跟隨
  desiredCameraFocus.set(player.position.x, player.position.y + 0.25, player.position.z); // 將攝影機目標對準主角上半身
  cameraFocus.lerp(desiredCameraFocus, 1 - Math.exp(-4.2 * deltaSeconds)); // 以時間差無關方式平滑跟隨主角
  updateCamera(); // 依平滑後焦點更新相機姿態
} // 結束攝影機平滑跟隨
function updatePlayer(p, deltaSeconds) { // 讀取方向鍵或自動目的地並更新主角
  if (!player) return; // 主角尚未建立時略過控制更新
  let inputX = Number(p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) - Number(p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)); // 讀取左右方向鍵或 A／D
  let inputY = Number(p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) - Number(p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)); // 讀取上下方向鍵或 W／S
  let worldDirection = new THREE.Vector3(); // 建立目前輸入換算後的世界座標移動方向
  const keyboardMoving = inputX !== 0 || inputY !== 0; // 判斷玩家是否正在按住方向鍵
  if (keyboardMoving) { // 將螢幕方向換算成斜視相機下的地面方向
    const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); // 取得攝影機畫面向右對應的世界方向
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion); // 取得攝影機畫面向上對應的世界方向
    screenRight.y = 0; // 移除畫面右向量的垂直分量
    screenUp.y = 0; // 移除畫面上向量的垂直分量
    screenRight.normalize(); // 將水平畫面向右方向正規化
    screenUp.normalize(); // 將水平畫面向上方向正規化
    worldDirection.addScaledVector(screenRight, inputX).addScaledVector(screenUp, inputY).normalize(); // 組合斜視角下的世界移動方向
  } // 結束移動輸入來源判斷
  if (worldDirection.lengthSq() > 0) { // 僅在方向有效時推進主角
    const step = Math.min(3.2 * deltaSeconds, 0.12); // 限制單影格步長避免高速穿越障礙
    movePlayerBy(worldDirection.x * step, worldDirection.z * step); // 依碰撞與地面邊界移動主角
    player.rotation.y = Math.atan2(-worldDirection.x, -worldDirection.z); // 讓主角正面朝著目前行進方向
    playerWalkTime += deltaSeconds; // 累計主角正在行走的時間
    animateWalk0(player, playerWalkTime); // 擺動主角四肢呈現連續步行
  } else { // 沒有移動輸入時讓主角自然站立
    animateWalk0(player, 0); // 將手腳擺動重設為站立姿勢
    player.position.y = getWalkableArea(player.position.x, player.position.z)?.groundY ?? 1; // 讓主角保持在目前平台或橋面高度
  } // 結束主角步行動畫更新
} // 結束主角方向鍵與自動導航更新
function updateStampLabels(p) { // 將 3D 集章點轉換成 p5 畫布上的標籤位置
  p.push(); // 保存目前 p5 文字繪製狀態
  p.textSize(14); // 使用較大的字級計算標籤寬度
  for (const [index, site] of stampSites.entries()) { // 逐一更新五個地點的螢幕投影
    const markerProjected = site.markerAnchor.getWorldPosition(new THREE.Vector3()).project(camera); // 將地面印章錨點投影至 p5 畫布
    site.markerX = (markerProjected.x + 1) * p.width / 2; // 換算印章中心的水平畫布座標
    site.markerY = (1 - markerProjected.y) * p.height / 2; // 換算印章中心的垂直畫布座標
    site.markerSize = THREE.MathUtils.clamp(camera.zoom * p.height / 24, 54, 72); // 將地面印章放大並依相機倍率調整尺寸
    site.markerVisible = markerProjected.z > -1 && markerProjected.z < 1 && site.markerX > -site.markerSize && site.markerX < p.width + site.markerSize && site.markerY > 66 && site.markerY < p.height - 100; // 隱藏相機後方或視窗外印章
    site.screenX = site.markerX; // 讓白色地點標籤與地面印章水平對齊
    site.screenY = site.markerY - site.markerSize / 2 - 26; // 將白色膠囊標籤固定在印章上方
    site.labelWidth = Math.max(142, p.textWidth(`${String(index + 1).padStart(2, "0")}  ${site.name}`) + 62); // 依編號與地點名稱計算加大標籤寬度
    site.labelVisible = site.markerVisible && site.screenX > -site.labelWidth && site.screenX < p.width + site.labelWidth && site.screenY > 66 && site.screenY < p.height - 100; // 隱藏相機後方或視窗外標籤
  } // 結束集章標籤位置更新
  p.pop(); // 還原原本 p5 文字繪製狀態
} // 結束地點標籤投影
function drawStampInterface(p) { // 用 p5.js 繪製集章進度、白色膠囊標籤與說明
  p.push(); // 保存目前 p5 繪圖狀態
  p.rectMode(p.CENTER); // 將白色標籤以中心點定位
  p.textAlign(p.CENTER, p.CENTER); // 將標籤文字置中對齊
  p.textStyle(p.BOLD); // 將集章數字與標籤設為粗體
  p.textSize(14); // 設定易讀的集章標籤字級
  p.fill(255, 246); // 設定左上進度膠囊的白色半透明底
  const progressY = p.width < 360 ? 140 : 92; // 依極窄螢幕將集章進度移到按鈕列下方
  p.rect(108, progressY, 164, 40, 20); // 繪製尺寸加大的左上角集章進度膠囊
  p.fill("#263b42"); // 設定進度文字的深色
  p.text(`集章進度  ${completedStamps} / 5`, 108, progressY); // 顯示已完成的集章數量
  for (const site of stampSites) { // 逐一繪製固定在地面的平面海洋印章
    if (!site.markerVisible) continue; // 略過目前位於視野外的印章
    const inkColor = site.collected ? "#36a76b" : "#ef843e"; // 依完成狀態選擇綠色或橘色印章墨色
    p.noFill(); // 讓印章外圈保持空心
    p.stroke(inkColor); // 設定印章外圈墨色
    p.strokeWeight(3.2); // 加粗印章外圈方便辨認
    p.circle(site.markerX, site.markerY, site.markerSize); // 在地面投影位置畫出扁平印章圓圈
    p.noStroke(); // 關閉海洋圖案的外框
    drawSeaCreatureIcon(p, site.seaLifeIndex, site.markerX, site.markerY, site.markerSize * 0.7, inkColor); // 在圓圈中央畫出平面海洋生物印記
  } // 結束五個地面平面印章繪製
  for (const [index, site] of stampSites.entries()) { // 逐一繪製可點選的白色地點膠囊
    if (!site.labelVisible) continue; // 略過目前位於視野外的地點標籤
    const labelX = site.screenX; // 讀取標籤投影後的水平位置
    const labelY = site.screenY; // 讀取標籤投影後的垂直位置
    const width = site.labelWidth; // 讀取依名稱計算出的標籤寬度
    p.fill(255, 247); // 設定標籤本體的白色底板
    p.rect(labelX, labelY, width, 42, 21); // 繪製加高的白色圓膠囊地點標籤
    p.fill(site.collected ? "#3da86b" : "#ed7d3b"); // 依集章狀態設定編號圓點顏色
    p.circle(labelX - width / 2 + 23, labelY, 32); // 在標籤左側繪製加大的海洋生物圖示底
    drawSeaCreatureIcon(p, site.seaLifeIndex, labelX - width / 2 + 23, labelY, 21, "#fff8e9"); // 在徽章中繪製海洋生物剪影
    p.fill("#263b42"); // 設定地點名稱為深灰色
    p.text(`${String(index + 1).padStart(2, "0")}  ${site.name}`, labelX + 14, labelY); // 在白色膠囊中顯示兩位數編號與地點名稱
    site.labelBounds = { left: labelX - width / 2, right: labelX + width / 2, top: labelY - 24, bottom: labelY + 24 }; // 儲存加大標籤的點擊範圍
  } // 結束五個地點標籤繪製
  const infoSite = activeStamp; // 顯示最近完成集章地點的說明
  const panelWidth = Math.min(p.width - 32, 560); // 依視窗寬度限制底部說明面板寬度
  const panelY = p.height - 91; // 設定加高說明面板的中心位置
  p.fill(255, 237); // 設定底部白色說明面板底色
  p.rect(p.width / 2, panelY, panelWidth, 72, 16); // 繪製加高的地點介紹膠囊面板
  p.textAlign(p.LEFT, p.CENTER); // 將面板標題與說明靠左對齊
  p.fill("#263b42"); // 設定面板標題的深色
  p.textSize(16); // 放大面板地點名稱字級
  p.textStyle(p.BOLD); // 將面板地點名稱設為粗體
  const infoTitle = completedStamps === stampSites.length ? "全部集滿！浮島巡遊完成" : infoSite ? `${infoSite.name}${infoSite.collected ? "・已蓋章" : "・前往中"}` : "浮島集章巡遊"; // 依集章狀態選擇面板標題
  p.text(infoTitle, p.width / 2 - panelWidth / 2 + 18, panelY - 17); // 顯示放大的地點名稱或完成訊息
  p.fill("#52676b"); // 設定地點說明的柔和深灰色
  p.textSize(13); // 放大地點說明字級
  p.textStyle(p.NORMAL); // 將地點說明恢復一般字重
  const infoText = completedStamps === stampSites.length ? "五個地點的紀念章都已收集完成。" : infoSite?.description ?? "使用方向鍵走進地面印章，滑鼠只調整鏡頭。"; // 依目前狀態顯示地點介紹或操作提示
  const wrappedInfoText = wrapP5Text(p, infoText, panelWidth - 36); // 依面板可用字寬逐字換行
  p.textAlign(p.LEFT, p.TOP); // 將可換行的地點說明靠左上對齊
  p.text(wrappedInfoText, p.width / 2 - panelWidth / 2 + 18, panelY + 3); // 在底部面板內顯示已換行的地點說明
  p.pop(); // 還原 p5 繪圖狀態
} // 結束集章介面繪製
function navigateToStamp(site) { // 將主角導航目的地設定為指定集章圓心
  if (isBlockedAt(site.x, site.z, 0.2)) return false; // 避免把導航終點放在樹木或建築內
  selectedStamp = site; // 更新正在前往的地點說明
  const waypoints = createIslandRoute(site); // 依所在島嶼產生安全的橋口路徑
  destination = { x: site.x, z: site.z, groundY: site.groundY, site, waypoints, waypointIndex: 0 }; // 儲存集章目標與跨島路徑
  return true; // 回報導航目標已設定
} // 結束集章地點導航設定
function getPlatformIndex(x, z) { // 判斷座標位於哪座島或哪一側橋口
  for (const [index, spec] of platformSpecs.entries()) { // 逐一檢查五座方形平台範圍
    if (Math.abs(x - spec.x) <= spec.size / 2 && Math.abs(z - spec.z) <= spec.size / 2) return index; // 回傳位於平台上的島嶼編號
  } // 結束方形平台位置檢查
  const area = getWalkableArea(x, z, 0); // 查找角色目前是否位於橋面
  if (area?.kind === "bridge") { // 在橋上時依距離判斷較靠近哪端
    let closestIndex = 0; // 預設橋面中央端連接公園
    let closestDistance = Infinity; // 初始化最近橋口距離
    for (let index = 1; index < bridgeGates.length; index += 1) { // 逐一比較四座橋的兩端
      const gate = bridgeGates[index]; // 讀取目前橋梁的端點
      for (const [platformIndex, point] of [[0, gate.center], [index, gate.outer]]) { // 比較中央端與外島端距離
        const distance = Math.hypot(x - point.x, z - point.z); // 計算角色到橋口的水平距離
        if (distance < closestDistance) { // 更新目前最近的橋口
          closestDistance = distance; // 儲存更短的橋口距離
          closestIndex = platformIndex; // 儲存最近橋口所屬島嶼
        } // 結束最近橋口更新
      } // 結束目前橋梁兩端比較
    } // 結束四座橋面比較
    return closestIndex; // 回傳距離角色最近的橋口島嶼
  } // 結束橋面島嶼判斷
  let closestIndex = 0; // 預設回傳中央公園平台
  let closestDistance = Infinity; // 初始化最近平台中心距離
  for (const [index, spec] of platformSpecs.entries()) { // 逐一比較五座島中心
    const distance = Math.hypot(x - spec.x, z - spec.z); // 計算目前座標與平台中心的距離
    if (distance < closestDistance) { // 更新目前最近的平台中心
      closestDistance = distance; // 儲存更短的平台中心距離
      closestIndex = index; // 儲存目前最近的島嶼編號
    } // 結束最近平台中心更新
  } // 結束平台中心比較
  return closestIndex; // 回傳距離最近的島嶼編號
} // 結束所在島嶼查找
function createIslandRoute(site) { // 建立由目前島嶼跨橋抵達集章點的安全路徑
  const sourceIndex = getPlatformIndex(player.position.x, player.position.z); // 查找主角目前所在島嶼
  const targetIndex = site.platformIndex; // 讀取目標集章點所屬島嶼
  const waypoints = []; // 建立依序前往的跨島路徑點
  if (sourceIndex !== targetIndex && sourceIndex !== 0) { // 從外島出發時先回到中央公園
    waypoints.push({ ...bridgeGates[sourceIndex].outer, groundY: 1.1 }); // 先走到目前外島的橋口
    waypoints.push({ ...bridgeGates[sourceIndex].center, groundY: 1.1 }); // 再沿橋走回中央公園
  } // 結束來源外島路徑建立
  if (sourceIndex !== targetIndex && targetIndex !== 0) { // 目標位於外島時從中央公園接上目標橋梁
    waypoints.push({ ...bridgeGates[targetIndex].center, groundY: 1.1 }); // 先走到目標橋梁的中央端
    waypoints.push({ ...bridgeGates[targetIndex].outer, groundY: 1.1 }); // 再沿橋抵達目標外島
  } // 結束目標外島路徑建立
  waypoints.push({ x: site.x, z: site.z, groundY: site.groundY }); // 最後走到集章圓心
  return waypoints; // 回傳完整的跨島導航路徑
} // 結束跨島路徑建立
function setDestinationFromScreen(p, screenX, screenY) { // 以 Raycaster 從畫面座標選取可行走地面
  pointerNdc.set(screenX / p.width * 2 - 1, -(screenY / p.height) * 2 + 1); // 將畫布位置轉換為正規化裝置座標
  raycaster.setFromCamera(pointerNdc, camera); // 從相機穿過滑鼠位置建立射線
  const intersections = raycaster.intersectObjects(walkableSurfaces, false); // 只檢查已登記的平台與橋面
  if (intersections.length === 0) return false; // 點到水面或場景外時不設定移動目標
  const hit = intersections[0]; // 取得最靠近相機的可走地面交點
  const area = hit.object.userData.walkableArea; // 讀取被點選地面所屬的平台或橋面
  if (!getWalkableArea(hit.point.x, hit.point.z, 0.2) || isBlockedAt(hit.point.x, hit.point.z, 0.2)) return false; // 忽略地面邊界外或障礙物中的目標
  selectedStamp = null; // 清除先前選取的集章說明
  const target = { x: hit.point.x, z: hit.point.z, groundY: area.groundY, platformIndex: getPlatformIndex(hit.point.x, hit.point.z) }; // 建立射線命中點及所在島嶼資料
  const waypoints = createIslandRoute(target); // 依所在島嶼規劃經由連橋前往目標的路徑
  destination = { ...target, site: null, waypoints, waypointIndex: 0 }; // 儲存地面點擊目標與跨島路徑
  return true; // 回報地面導航目標已設定
} // 結束 Raycaster 地面導航
function updateStampProgress() { // 檢查主角是否走進尚未完成的集章圓圈
  if (!player) return; // 主角尚未建立時略過集章檢查
  for (const site of stampSites) { // 逐一檢查五個集章地點
    if (site.collected || Math.abs(player.position.y - site.groundY) > 0.18) continue; // 略過已完成或不同高度的地點
    if (Math.hypot(player.position.x - site.x, player.position.z - site.z) > site.radius) continue; // 主角尚未走進橘色圓圈時繼續檢查
    site.collected = true; // 記錄目前地點已經完成集章
    completedStamps += 1; // 增加已完成的集章數量
    activeStamp = site; // 將最新完成的地點設為說明面板內容
  } // 結束五個集章點碰觸檢查
} // 結束集章進度更新
let cameraFollowEnabled = true; // 記錄攝影機是否平滑跟隨主角
let dragging = false; // 記錄滑鼠是否正在拖曳旋轉視角
let previousPointerX = 0; // 記錄上一次滑鼠水平位置
let previousPointerY = 0; // 記錄上一次滑鼠垂直位置
const interfaceSketch = (p) => { // 建立以 p5.js 負責的 2D 操作介面
  p.setup = () => { // 設定 p5.js 介面畫布
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight); // 建立覆蓋全視窗的介面畫布
    canvas.elt.setAttribute("aria-label", "海灣公共服務島操作介面"); // 為介面畫布加上無障礙名稱
    p.pixelDensity(1); // 固定介面像素密度以保持繪製效率
    p.textFont("sans-serif"); // 使用系統中文字型呈現繁體中文介面
    p.noStroke(); // 關閉介面圖形預設外框
    createCharacterEditor(); // 建立可收合的角色創作表單
  }; // 結束 p5.js 介面設定
  p.draw = () => { // 每一影格繪製操作提示與狀態介面
    p.clear(); // 清除介面畫布並保留透明背景
    const deltaSeconds = Math.min(p.deltaTime / 1000, 0.05); // 限制單影格時間避免移動瞬間跳躍
    updatePlayer(p, deltaSeconds); // 依方向鍵或滑鼠目的地更新主角
    updateCameraFollow(deltaSeconds); // 平滑更新跟隨主角的攝影機
    const elapsed = p.millis() / 1000; // 取得供所有循環動畫共用的經過秒數
    updateWalkerRoutes(elapsed); // 讓場景公仔持續沿步道行走
    updateWaterWaves(elapsed); // 讓海面持續產生細緻自然的微波
    updateMarineLife(elapsed); // 更新海鳥翅膀、魚群游動與小船漂浮
    updateStampProgress(); // 檢查主角是否進入任一集章圓圈
    updateStampLabels(p); // 更新集章標籤在目前畫面中的投影座標
    drawCharacterName(p); // 在主角上方繪製目前使用者設定的角色名稱
    p.fill("#14343a"); // 設定清晰的深色主標題
    p.textAlign(p.LEFT, p.TOP); // 將標題文字靠左上對齊
    p.textSize(19); // 設定主標題字級
    p.textStyle(p.BOLD); // 將主標題設定為粗體
    p.text("海灣公共服務島", 28, 24); // 顯示五島公共服務場景名稱
    p.textStyle(p.NORMAL); // 將後續文字恢復一般字重
    p.fill("#34565a"); // 設定英文副標題顏色
    p.textSize(11); // 放大英文副標題字級
    p.text("SCHOOL  /  CIVIC ISLANDS", 29, 51); // 顯示校園與公共服務島英文標識
    p.textAlign(p.CENTER, p.CENTER); // 將操作按鈕文字置中對齊
    const actionLayout = getActionButtonLayout(p); // 取得符合目前畫面寬度的頂部按鈕位置
    drawButton(p, actionLayout.followX, actionLayout.y, actionLayout.width, 42, cameraFollowEnabled ? "跟隨" : "自由", "#f1c84d"); // 繪製相機跟隨模式切換按鈕
    drawButton(p, actionLayout.resetX, actionLayout.y, actionLayout.width, 42, "重設視角", "#f4f3e8"); // 繪製加大的視角重設操作按鈕
    drawZoomControls(p); // 繪製畫面右側的放大與縮小按鈕
    p.textAlign(p.LEFT, p.BOTTOM); // 將底部操作提示靠左下對齊
    p.fill("#34565a"); // 設定底部操作提示文字顏色
    p.textSize(15); // 放大底部鍵盤與滑鼠操作提示字級
    p.text(p.width < 360 ? "方向鍵移動・滑鼠調角" : p.width < 520 ? "方向鍵移動・滑鼠旋轉・滾輪縮放" : "鍵盤 ↑↓←→ 移動   ·   滑鼠拖曳調角   ·   滾輪縮放", 28, p.height - 25); // 明確顯示鍵盤移動與滑鼠鏡頭功能
    p.textAlign(p.RIGHT, p.BOTTOM); // 將平台統計資訊靠右下對齊
    p.fill("#34565a"); // 設定島嶼與行人統計文字顏色
    p.textSize(p.width < 520 ? 12 : 13); // 依畫面寬度調整人物統計字級
    if (p.width >= 360) p.text(p.width < 520 ? "10路人・1釣客" : "5 座服務島  /  10 位路人・1 位釣客", p.width - 28, p.height - 25); // 顯示分散於各島的路人與釣魚者數量
    drawStampInterface(p); // 以 p5 繪製白色集章標籤與地點說明
    renderer.render(scene, camera); // 由 p5 主迴圈更新 Three.js 3D 場景
  }; // 結束每影格介面繪製
  p.mousePressed = () => { // 處理按鈕點擊與視角拖曳起始
    const pointerX = p.mouseX; // 取得滑鼠的水平座標
    const pointerY = p.mouseY; // 取得滑鼠的垂直座標
    const actionLayout = getActionButtonLayout(p); // 取得目前頂部操作按鈕點擊範圍
    if (pointerY >= actionLayout.y && pointerY <= actionLayout.y + 42 && pointerX >= actionLayout.followX && pointerX <= actionLayout.followX + actionLayout.width) { // 判斷是否點擊相機跟隨切換按鈕
      cameraFollowEnabled = !cameraFollowEnabled; // 切換自動跟隨與自由環繞視角
      return false; // 阻止按鈕點擊觸發相機拖曳
    } // 結束日夜按鈕點擊判斷
    if (pointerY >= actionLayout.y && pointerY <= actionLayout.y + 42 && pointerX >= actionLayout.resetX && pointerX <= actionLayout.resetX + actionLayout.width) { // 判斷是否點擊視角重設按鈕
      cameraAngle = 0.66; // 將水平角度還原為預設值
      cameraElevation = 0.76; // 將俯視角度還原為預設值
      cameraZoom = 1; // 將攝影機縮放倍率還原為預設值
      updateCamera(); // 立即套用預設攝影機位置
      return false; // 阻止按鈕點擊觸發視角拖曳
    } // 結束視角重設按鈕點擊判斷
    const zoomControlX = p.width - 48; // 計算加大縮放按鈕的水平位置
    const zoomInY = p.height / 2 - 34; // 計算放大按鈕的垂直位置
    const zoomOutY = p.height / 2 + 34; // 計算縮小按鈕的垂直位置
    if (Math.hypot(pointerX - zoomControlX, pointerY - zoomInY) <= 30) { // 判斷是否點擊放大按鈕
      cameraZoom = THREE.MathUtils.clamp(cameraZoom * 1.2, 0.65, 2.8); // 增加縮放倍率並限制最大值
      updateCamera(); // 套用放大後的攝影機視野
      return false; // 阻止放大按鈕觸發視角拖曳
    } // 結束放大按鈕點擊判斷
    if (Math.hypot(pointerX - zoomControlX, pointerY - zoomOutY) <= 30) { // 判斷是否點擊縮小按鈕
      cameraZoom = THREE.MathUtils.clamp(cameraZoom / 1.2, 0.65, 2.8); // 降低縮放倍率並限制最小值
      updateCamera(); // 套用縮小後的攝影機視野
      return false; // 阻止縮小按鈕觸發視角拖曳
    } // 結束縮小按鈕點擊判斷
    dragging = true; // 開始記錄滑鼠拖曳以控制攝影機
    previousPointerX = pointerX; // 記錄拖曳開始時的水平位置
    previousPointerY = pointerY; // 記錄拖曳開始時的垂直位置
    return false; // 阻止拖曳操作觸發瀏覽器預設行為
  }; // 結束滑鼠按下事件處理
  p.mouseDragged = () => { // 依滑鼠移動更新環繞攝影機角度
    if (!dragging) return false; // 未進入拖曳狀態時不更新視角
    cameraAngle -= (p.mouseX - previousPointerX) * 0.006; // 依水平拖曳距離旋轉攝影機方位
    cameraElevation = THREE.MathUtils.clamp(cameraElevation + (p.mouseY - previousPointerY) * 0.005, minCameraElevation, maxCameraElevation); // 依垂直拖曳調整俯視角度並限制在二十至七十度
    previousPointerX = p.mouseX; // 更新滑鼠水平座標供下一影格使用
    previousPointerY = p.mouseY; // 更新滑鼠垂直座標供下一影格使用
    updateCamera(); // 套用拖曳後的新攝影機視角
    return false; // 阻止拖曳操作觸發瀏覽器預設行為
  }; // 結束滑鼠拖曳事件處理
  p.mouseWheel = (event) => { // 讓滑鼠滾輪也能調整場景縮放
    cameraZoom = THREE.MathUtils.clamp(cameraZoom * (event.delta > 0 ? 1 / 1.12 : 1.12), 0.65, 2.8); // 依滾輪方向調整並限制縮放倍率
    updateCamera(); // 套用滾輪調整後的攝影機視野
    return false; // 阻止滾輪操作觸發瀏覽器頁面捲動
  }; // 結束滑鼠滾輪事件處理
  p.mouseReleased = () => { // 在滑鼠放開時結束視角拖曳
    dragging = false; // 關閉視角拖曳狀態
  }; // 結束滑鼠放開事件處理
  p.keyPressed = () => { // 阻止方向鍵操作時瀏覽器捲動頁面
    if ([p.LEFT_ARROW, p.RIGHT_ARROW, p.UP_ARROW, p.DOWN_ARROW].includes(p.keyCode)) return false; // 方向鍵交由公仔移動控制
  }; // 結束方向鍵預設行為處理
  p.windowResized = () => { // 在視窗尺寸改變時同步調整兩種畫布
    p.resizeCanvas(p.windowWidth, p.windowHeight); // 調整 p5.js 介面畫布尺寸
    renderer.setSize(p.windowWidth, p.windowHeight); // 調整 Three.js 渲染畫布尺寸
    const aspect = p.windowWidth / p.windowHeight; // 計算視窗寬高比例
    const halfHeight = Math.max(14.5, 18 / aspect); // 依直向或橫向視窗調整垂直取景範圍
    camera.left = -halfHeight * aspect; // 依視窗比例更新攝影機左側範圍
    camera.right = halfHeight * aspect; // 依視窗比例更新攝影機右側範圍
    camera.top = halfHeight; // 保持攝影機上側範圍不變
    camera.bottom = -halfHeight; // 保持攝影機下側範圍不變
    camera.updateProjectionMatrix(); // 套用新的正交投影範圍
  }; // 結束視窗尺寸變更處理
}; // 結束 p5.js 介面繪圖與互動定義
function getActionButtonLayout(p) { // 依視窗寬度配置日夜與視角按鈕
  const compact = p.width < 420; // 判斷是否使用窄螢幕按鈕尺寸
  const width = compact ? 88 : 112; // 依螢幕寬度設定加大的操作按鈕寬度
  const gap = compact ? 8 : 14; // 依螢幕寬度設定兩個操作按鈕的間距
  const margin = compact ? 10 : 28; // 依螢幕寬度設定按鈕與右側邊界間距
  const followX = p.width - margin - width * 2 - gap; // 計算相機跟隨切換按鈕的水平座標
  const resetX = p.width - margin - width; // 計算重設按鈕的水平座標
  const y = p.width < 320 ? 72 : 24; // 在極窄畫面將操作按鈕移至標題下方
  return { followX, resetX, width, y }; // 回傳繪製與點擊共用的按鈕位置
} // 結束窄螢幕按鈕排版
function wrapP5Text(p, text, maxWidth) { // 依 p5 字型寬度為中英文說明自動換行
  const lines = []; // 建立逐行儲存的說明文字陣列
  let line = ""; // 初始化目前正在組合的文字行
  for (const character of text) { // 逐一檢查每個中文字或標點符號
    if (line && p.textWidth(line + character) > maxWidth) { // 判斷加入字元後是否超過面板寬度
      lines.push(line); // 將已填滿的文字行加入陣列
      line = character; // 從目前字元開始下一行
    } else { // 目前文字行仍可容納新字元
      line += character; // 將字元接到目前文字行尾端
    } // 結束文字行寬度判斷
  } // 結束逐字換行檢查
  if (line) lines.push(line); // 將最後一行文字加入陣列
  return lines.join("\n"); // 回傳以換行符號連接的面板文字
} // 結束 p5 文字換行工具
function drawButton(p, x, y, width, height, label, color) { // 繪製 p5.js 介面上的圓角操作按鈕
  p.fill(color); // 設定按鈕底色
  p.rect(x, y, width, height, 5); // 繪製小圓角按鈕背景
  p.fill("#18363a"); // 設定按鈕文字顏色
  p.textSize(14); // 放大按鈕文字字級
  p.textStyle(p.BOLD); // 將按鈕文字設定為粗體
  p.text(label, x + width / 2, y + height / 2); // 在按鈕中央顯示文字
  p.textStyle(p.NORMAL); // 將文字字重恢復一般狀態
} // 結束操作按鈕繪製
function drawZoomControls(p) { // 在畫面右側繪製可點擊的縮放控制
  const controlX = p.width - 48; // 設定加大縮放按鈕靠近畫面右側的位置
  const zoomInY = p.height / 2 - 34; // 設定放大按鈕的垂直位置
  const zoomOutY = p.height / 2 + 34; // 設定縮小按鈕的垂直位置
  p.noStroke(); // 移除縮放按鈕的預設外框
  p.fill("#f1c84d"); // 設定放大按鈕的亮黃色底色
  p.circle(controlX, zoomInY, 52); // 繪製加大的放大按鈕圓形底板
  p.fill("#18363a"); // 設定放大符號的深色
  p.textStyle(p.BOLD); // 將放大符號設定為粗體
  p.textSize(29); // 放大縮放按鈕的符號字級
  p.text("+", controlX, zoomInY - 1); // 在圓形按鈕中央顯示加號
  p.fill("#f4f3e8"); // 設定縮小按鈕的淺色底色
  p.circle(controlX, zoomOutY, 52); // 繪製加大的縮小按鈕圓形底板
  p.fill("#18363a"); // 設定縮小符號的深色
  p.text("−", controlX, zoomOutY - 1); // 在圓形按鈕中央顯示減號
  p.textStyle(p.NORMAL); // 將符號字重恢復一般狀態
} // 結束縮放按鈕繪製
function createCharacterEditor() { // 建立右側可收合的 HTML 角色創作面板
  const panel = document.createElement("aside"); // 建立角色設定側邊面板
  panel.className = "character-editor"; // 指定角色編輯面板樣式類別
  panel.setAttribute("aria-label", "設定你的進入者"); // 為角色設定面板加上無障礙名稱
  const toggle = document.createElement("button"); // 建立開啟或收合面板的按鈕
  toggle.className = "character-editor-toggle"; // 指定面板切換按鈕樣式類別
  toggle.type = "button"; // 避免切換按鈕送出表單
  const form = document.createElement("form"); // 建立角色設定表單
  form.className = "character-editor-form"; // 指定表單內容樣式類別
  const heading = document.createElement("h2"); // 建立角色編輯面板標題
  heading.textContent = "設定你的進入者"; // 顯示角色編輯標題
  const summary = document.createElement("p"); // 建立面板副標題
  summary.textContent = "打造你的島上同行者"; // 說明目前可編輯角色外觀
  panel.append(heading, summary, form); // 將標題與表單放入側邊面板
  document.body.append(panel, toggle); // 將面板與固定切換按鈕放入頁面
  let expanded = window.innerWidth >= 760; // 依畫面寬度決定初始是否展開面板
  panel.classList.toggle("is-collapsed", !expanded); // 在窄螢幕預設收合角色表單
  toggle.textContent = expanded ? "收起設定" : "創作角色"; // 顯示符合面板狀態的切換文字
  toggle.addEventListener("click", () => { // 處理設定面板展開與收合
    expanded = !expanded; // 切換目前面板狀態
    panel.classList.toggle("is-collapsed", !expanded); // 套用新的面板顯示狀態
    toggle.textContent = expanded ? "收起設定" : "創作角色"; // 更新切換按鈕文字
  }); // 結束面板切換事件
  function addField(labelText, control) { // 建立含標題的表單欄位
    const row = document.createElement("label"); // 建立可點選的標籤欄位容器
    row.className = "character-editor-field"; // 指定欄位容器樣式類別
    const label = document.createElement("span"); // 建立欄位名稱文字
    label.textContent = labelText; // 設定欄位名稱
    row.append(label, control); // 將欄位標題與輸入控制放在一起
    form.append(row); // 將完整欄位加入表單
    return control; // 回傳輸入控制供儲存事件讀取
  } // 結束表單欄位建立
  function createSelect(options) { // 建立含標準選項的下拉選單
    const select = document.createElement("select"); // 建立原生下拉選單
    for (const [label, value] of options) { // 逐一加入選單選項
      const option = document.createElement("option"); // 建立單一選項節點
      option.textContent = label; // 設定選項顯示文字
      option.value = value; // 設定選項實際值
      select.append(option); // 將選項加入下拉選單
    } // 結束選項建立
    return select; // 回傳完成的下拉選單
  } // 結束下拉選單建立
  function createColorInput(value) { // 建立原生顏色選擇器
    const input = document.createElement("input"); // 建立顏色輸入元素
    input.type = "color"; // 設定輸入種類為色票選擇器
    input.value = value; // 設定預設顏色
    return input; // 回傳顏色選擇器
  } // 結束顏色選擇器建立
  function createCheck(labelText, checked) { // 建立安全帽、帽子或背包核取方塊
    const label = document.createElement("label"); // 建立核取方塊標籤容器
    label.className = "character-editor-check"; // 指定核取欄位樣式類別
    const input = document.createElement("input"); // 建立核取方塊輸入
    input.type = "checkbox"; // 設定輸入種類為核取方塊
    input.checked = checked; // 設定核取方塊預設狀態
    const text = document.createElement("span"); // 建立核取方塊說明文字
    text.textContent = labelText; // 設定核取方塊說明
    label.append(input, text); // 將核取方塊與說明文字組合
    form.append(label); // 將核取方塊欄位加入表單
    return input; // 回傳核取方塊供角色建立使用
  } // 結束核取方塊建立
  const nameInput = addField("角色名稱", document.createElement("input")); // 建立可編輯的角色姓名欄位
  nameInput.type = "text"; // 將姓名欄位設定為文字輸入
  nameInput.maxLength = 12; // 限制名稱長度避免標籤過寬
  nameInput.value = "旅人"; // 設定角色預設名稱
  const companionSelect = addField("同行小動物", createSelect([["不攜帶", "none"], ["小海龜", "turtle"], ["小魚", "fish"], ["海鳥", "bird"]])); // 建立同行小動物選單
  const outfitSelect = addField("穿著樣式", createSelect([["活力外套", "jacket"], ["校園制服", "uniform"], ["海岸休閒", "coast"]])); // 建立角色服裝樣式選單
  const hairSelect = addField("髮型樣式", createSelect([["短髮", "short"], ["長髮", "long"], ["蓬鬆", "fluffy"]])); // 建立角色髮型選單
  const shirtColorInput = addField("上衣顏色", createColorInput("#e4674f")); // 建立上衣自訂色票
  const hairColorInput = addField("頭髮顏色", createColorInput("#493126")); // 建立頭髮自訂色票
  const hatColorInput = addField("帽子顏色", createColorInput("#347db8")); // 建立帽子自訂色票
  const sizeInput = addField("角色比例", document.createElement("input")); // 建立角色身高比例滑桿
  sizeInput.type = "range"; // 將比例控制設定為滑桿
  sizeInput.min = "0.82"; // 設定角色最小縮放值
  sizeInput.max = "1.28"; // 設定角色最大縮放值
  sizeInput.step = "0.02"; // 設定角色比例調整間隔
  sizeInput.value = "1.05"; // 設定角色預設比例
  const helmetInput = createCheck("戴安全帽", false); // 建立安全帽核取方塊
  const hatInput = createCheck("戴帽子", false); // 建立帽子核取方塊
  const backpackInput = createCheck("背背包", true); // 建立背包核取方塊
  const saveButton = document.createElement("button"); // 建立儲存角色按鈕
  saveButton.className = "character-editor-save"; // 指定儲存按鈕樣式類別
  saveButton.type = "submit"; // 設定儲存按鈕送出表單
  saveButton.textContent = "儲存並進入群島"; // 顯示角色建立按鈕文字
  form.append(saveButton); // 將儲存按鈕放在表單底部
  outfitSelect.addEventListener("change", () => { // 依服裝樣式套用合適上衣顏色
    const outfitColors = { jacket: "#e4674f", uniform: "#4f7898", coast: "#4d9b8a" }; // 設定三種服裝的預設色票
    shirtColorInput.value = outfitColors[outfitSelect.value]; // 更新上衣色票預覽
  }); // 結束服裝樣式變更事件
  form.addEventListener("submit", (event) => { // 儲存外觀並更新可操作主角
    event.preventDefault(); // 阻止表單重新載入頁面
    const previousPosition = player.position.clone(); // 保留目前主角所在位置
    const previousRotation = player.rotation.clone(); // 保留目前主角面向
    const replacement = makeChibi({ shirtColor: shirtColorInput.value, hairColor: hairColorInput.value, hairStyle: hairSelect.value, helmet: helmetInput.checked, hat: hatInput.checked, hatColor: hatColorInput.value, backpack: backpackInput.checked }); // 依表單設定建立新公仔
    replacement.position.copy(previousPosition); // 將新公仔放回目前所在位置
    replacement.rotation.copy(previousRotation); // 保留目前行走朝向
    replacement.scale.setScalar(Number(sizeInput.value)); // 套用角色比例滑桿設定
    replacement.userData.displayName = nameInput.value.trim() || "旅人"; // 儲存玩家自訂角色名稱
    attachCharacterCompanion(replacement, companionSelect.value); // 替角色加入所選同行小動物
    scene.remove(player); // 將舊角色從場景中移除
    player = replacement; // 將新角色設為可操作主角
    scene.add(player); // 將新主角加入場景
    cameraFollowEnabled = true; // 建立角色後恢復跟隨視角
    saveButton.textContent = `已進入群島・${replacement.userData.displayName}`; // 顯示角色已更新的完成狀態
  }); // 結束角色表單儲存事件
  if (window.innerWidth < 760) { // 在窄螢幕上預設收起編輯面板
    panel.classList.add("is-collapsed"); // 讓角色表單不遮住主要場景
    toggle.textContent = "創作角色"; // 顯示開啟角色表單的按鈕文字
  } else { // 在寬螢幕直接顯示角色編輯面板
    toggle.textContent = "收起設定"; // 顯示收起編輯面板的按鈕文字
  } // 結束依裝置寬度初始化面板
} // 結束角色創作面板建立
function attachCharacterCompanion(person, type) { // 將使用者選擇的小動物附加在角色身旁
  if (type === "none") return; // 選擇不攜帶動物時不建立寵物
  const companion = new THREE.Group(); // 建立同行小動物群組
  companion.position.set(-0.52, 0.08, 0.12); // 將小動物放在角色左後側
  person.add(companion); // 將小動物掛接於角色根群組
  const coat = new THREE.MeshStandardMaterial({ color: type === "turtle" ? "#5c9e76" : type === "fish" ? "#e5a84c" : "#f2eee2", roughness: 0.82, flatShading: true }); // 依動物種類設定低多邊數主色
  if (type === "turtle") { // 建立同行小海龜造型
    const shell = addSphere(companion, 0.2, coat, 0, 0.38, 0, 7, 5); // 建立小海龜橢圓龜殼
    shell.scale.set(1, 0.58, 0.78); // 將龜殼壓扁成圓背
    addSphere(companion, 0.08, materials.skin, 0, 0.35, -0.2, 6, 4); // 在龜殼前方加上小海龜頭部
  } else if (type === "fish") { // 建立同行小魚造型
    const body = addSphere(companion, 0.18, coat, 0, 0.4, 0, 7, 5); // 建立小魚圓形身體
    body.scale.set(0.7, 0.42, 1.1); // 將魚身拉長成水滴形
    addBox(companion, 0.08, 0.08, 0.18, coat, 0, 0.4, 0.2); // 在魚尾加上小型尾鰭
  } else { // 建立同行小海鳥造型
    const birdBody = addSphere(companion, 0.17, coat, 0, 0.4, 0, 7, 5); // 建立小海鳥圓潤身體
    birdBody.scale.set(1, 0.68, 0.72); // 將鳥身調整成短胖輪廓
    addBox(companion, 0.1, 0.08, 0.12, materials.postRed, 0, 0.37, -0.17); // 為小海鳥加上橘色短喙
  } // 結束同行小動物造型判斷
} // 結束角色同行小動物建立
function drawCharacterName(p) { // 在主角上方顯示使用者設定的角色名稱
  if (!player?.userData.displayName) return; // 尚未設定名稱時略過姓名標籤
  const point = new THREE.Vector3(player.position.x, player.position.y + 2.25, player.position.z).project(camera); // 將主角上方位置投影到 p5 畫布
  if (point.z < -1 || point.z > 1) return; // 主角位於鏡頭外時不顯示姓名
  const x = (point.x + 1) * p.width / 2; // 換算姓名標籤水平位置
  const y = (1 - point.y) * p.height / 2; // 換算姓名標籤垂直位置
  p.push(); // 保存目前 p5 繪圖狀態
  p.rectMode(p.CENTER); // 將姓名膠囊以中心點定位
  p.textAlign(p.CENTER, p.CENTER); // 將姓名文字置中對齊
  p.textSize(12); // 設定姓名標籤字級
  p.fill(255, 238); // 設定姓名膠囊的白色半透明底
  p.rect(x, y, p.textWidth(player.userData.displayName) + 22, 28, 14); // 繪製主角上方姓名膠囊
  p.fill("#263b42"); // 設定姓名文字顏色
  p.text(player.userData.displayName, x, y); // 顯示使用者設定的角色名稱
  p.pop(); // 還原 p5 繪圖狀態
} // 結束角色姓名標籤繪製
new p5(interfaceSketch); // 建立 p5.js 實例並以其 draw 作為唯一主迴圈
