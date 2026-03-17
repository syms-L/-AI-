import React, { useState, useEffect, useMemo } from 'react';
import { Cpu, Video, HardDrive, Zap, Server, Activity, Info, CheckCircle2, AlertTriangle, Settings2, Clock, ChevronUp, ChevronDown, Layers } from 'lucide-react';

// --- 常量与数据字典 ---

const RESOLUTIONS = {
  '480P': { name: '480P (854x480)', pixels: 854 * 480 },
  '720P': { name: '720P (1280x720)', pixels: 1280 * 720 },
  '1080P': { name: '1080P (1920x1080)', pixels: 1920 * 1080 },
  '2K': { name: '2K (2560x1440)', pixels: 2560 * 1440 },
  '4K': { name: '4K (3840x2160)', pixels: 3840 * 2160 },
};

const FORMATS = [
  { id: 'H.264', name: 'H.264', hwDecode: true, decodeMultiplier: 1.0 },
  { id: 'H.265', name: 'H.265 (HEVC)', hwDecode: true, decodeMultiplier: 1.2 },
  { id: 'MJPG', name: 'MJPEG', hwDecode: false, decodeMultiplier: 1.5 },
  { id: 'Raw', name: 'Raw', hwDecode: false, decodeMultiplier: 0.5 },
  { id: 'YUV', name: 'YUV', hwDecode: false, decodeMultiplier: 0.5 },
  { id: 'YUY2', name: 'YUY2', hwDecode: false, decodeMultiplier: 0.5 },
];

const MODELS = {
  'YOLOv8n': { name: 'YOLOv8 Nano', gflops: 8.7, vram: 0.2, activationVram: 0.05 },
  'YOLOv8s': { name: 'YOLOv8 Small', gflops: 28.4, vram: 0.5, activationVram: 0.1 },
  'YOLOv8m': { name: 'YOLOv8 Medium', gflops: 78.9, vram: 1.2, activationVram: 0.2 },
  'YOLOv8l': { name: 'YOLOv8 Large', gflops: 165.2, vram: 2.5, activationVram: 0.4 },
  'YOLOv8x': { name: 'YOLOv8 XLarge', gflops: 257.8, vram: 4.0, activationVram: 0.6 },
};

const CV_ALGORITHMS = {
  'None': { name: '无 (仅 AI)', gflops: 0 },
  'Low': { name: '低 (如 简单滤波, 运动检测)', gflops: 5 },
  'Medium': { name: '中 (如 特征提取, 复杂追踪)', gflops: 15 },
  'High': { name: '高 (如 密集光流, 3D 重建)', gflops: 50 },
};

const STORAGE_MODES = {
  'None': { name: '不存储 (仅内存处理)' },
  'VideoStream': { name: '保存视频流 (H.264/265)' },
  'FrameImages': { name: '保存抽帧图片 (JPEG)' },
  'Metadata': { name: '仅保存元数据 (JSON/DB)' },
};

const STORAGE_MEDIUMS = {
  'eMMC_SD': { name: 'eMMC / SD卡', maxThroughput: 80, maxIops: 2000 },
  'SATA_SSD': { name: 'SATA SSD', maxThroughput: 500, maxIops: 50000 },
  'NVMe_SSD': { name: 'NVMe SSD', maxThroughput: 2500, maxIops: 200000 },
};

// nvdecPps: NVDEC 硬件解码上限 (Pixels Per Second)。
// 参考: 18x 1080p30 = 18 * 1920 * 1080 * 30 ≈ 1.12 GPixels/s
const DEVICES = [
  { name: 'Raspberry Pi 4 4GB', tops: 0.1, gflops: 13.5, ram: 4, nvdecPps: 0 },
  { name: 'Raspberry Pi 5 8GB', tops: 0.5, gflops: 50, ram: 8, nvdecPps: 0 },
  { name: 'Jetson Nano 4GB', tops: 0.472, gflops: 472, ram: 4, nvdecPps: 250000000 },
  { name: 'Jetson TX2 NX 4GB', tops: 1.33, gflops: 1330, ram: 4, nvdecPps: 500000000 },
  { name: 'Jetson Xavier NX 8GB', tops: 21, gflops: 21000, ram: 8, nvdecPps: 1000000000 },
  { name: 'Jetson Orin Nano 4GB', tops: 20, gflops: 20000, ram: 4, nvdecPps: 0 }, // 无 NVDEC
  { name: 'Jetson Orin Nano 8GB', tops: 40, gflops: 40000, ram: 8, nvdecPps: 0 }, // 无 NVDEC
  { name: 'Jetson Orin NX 8GB', tops: 70, gflops: 70000, ram: 8, nvdecPps: 1119744000 },
  { name: 'Jetson Orin NX 16GB', tops: 100, gflops: 100000, ram: 16, nvdecPps: 1119744000 },
  { name: 'Jetson AGX Orin 32GB', tops: 200, gflops: 200000, ram: 32, nvdecPps: 1119744000 },
  { name: 'Jetson AGX Orin 64GB', tops: 275, gflops: 275000, ram: 64, nvdecPps: 2239488000 }, // 双 NVDEC
];

const Tooltip = ({ children, content }: { children: React.ReactNode, content: React.ReactNode }) => (
  <div className="relative group/tooltip">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-zinc-800 text-xs text-zinc-200 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 border border-zinc-700 pointer-events-none">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-800"></div>
    </div>
  </div>
);

export default function App() {
  // --- 状态管理 ---
  const [cameras, setCameras] = useState<number>(4);
  const [format, setFormat] = useState<string>('H.265');
  const [resolution, setResolution] = useState<keyof typeof RESOLUTIONS>('1080P');
  const [fps, setFps] = useState<number>(30);
  const [model, setModel] = useState<keyof typeof MODELS>('YOLOv8s');
  const [cvAlgo, setCvAlgo] = useState<keyof typeof CV_ALGORITHMS>('None');
  const [precision, setPrecision] = useState<'INT8' | 'FP16'>('INT8');
  const [storageMode, setStorageMode] = useState<keyof typeof STORAGE_MODES>('None');
  const [storageMedium, setStorageMedium] = useState<keyof typeof STORAGE_MEDIUMS>('eMMC_SD');
  const [manualDeviceIndex, setManualDeviceIndex] = useState<number | null>(null);

  // 当输入参数改变时，重置手动选择的设备
  useEffect(() => {
    setManualDeviceIndex(null);
  }, [cameras, format, resolution, fps, model, cvAlgo, precision, storageMode, storageMedium]);

  // --- 核心计算逻辑 ---
  const results = useMemo(() => {
    const resData = RESOLUTIONS[resolution];
    const formatData = FORMATS.find(f => f.id === format)!;
    const modelData = MODELS[model];
    const cvData = CV_ALGORITHMS[cvAlgo];

    // 1. 算力计算 (TOPS & GFLOPS)
    // AI 公式: 所需总算力 (TOPS) = (数量 × 帧率 × 单帧 GFLOPS / 1000) × 编解码系数 × 精度系数 × (1 + 冗余系数)
    const baseTflops = (cameras * fps * modelData.gflops) / 1000;
    
    // 精度系数: FP16 模式下，对比设备 TOPS 的 50% (等效于需求翻倍)
    const precisionMultiplier = precision === 'FP16' ? 2.0 : 1.0;
    const redundancy = 0.3; // 30% 冗余系数

    const requiredTops = baseTflops * formatData.decodeMultiplier * precisionMultiplier * (1 + redundancy);

    // 传统 CV 算力需求 (GFLOPS)，随分辨率缩放 (以 1080P 为基准)
    const resScale = resData.pixels / (1920 * 1080);
    const requiredCvGflops = cameras * fps * cvData.gflops * resScale * (1 + redundancy);

    // 2. 显存计算 (GB)
    const baseOsVram = 1.5; // OS 及基础服务占用
    const modelVram = modelData.vram * (precision === 'FP16' ? 1.5 : 1.0); // 模型权重占用 (假设共享权重)
    
    // 每路摄像头的额外显存开销 (随路数线性增长):
    // a. 视频解码缓冲区 (假设 YUV420 1.5 bytes/pixel, 深度为 8 帧)
    const decodeBufferVramPerCam = (resData.pixels * 1.5 * 8) / (1024 * 1024 * 1024);
    // b. 预处理内存 (RGB 转换、缩放等, 3 bytes/pixel, 深度为 3 帧)
    const preprocessVramPerCam = (resData.pixels * 3 * 3) / (1024 * 1024 * 1024);
    // c. 推理中间激活值 (Activations)
    const activationVramPerCam = modelData.activationVram * (precision === 'FP16' ? 2.0 : 1.0);
    
    const perCamVram = decodeBufferVramPerCam + preprocessVramPerCam + activationVramPerCam;
    const totalStreamVram = cameras * perCamVram;
    const totalVram = baseOsVram + modelVram + totalStreamVram;

    // 3. 设备推荐
    const suitableDevices = DEVICES.filter(d => d.tops >= requiredTops && (d.gflops || 0) >= requiredCvGflops && d.ram >= totalVram);
    // 如果没有合适的设备，默认选中最高配置的设备以展示超载情况
    const autoDeviceIndex = suitableDevices.length > 0 ? DEVICES.indexOf(suitableDevices[0]) : DEVICES.length - 1;
    
    const activeDeviceIndex = manualDeviceIndex !== null ? manualDeviceIndex : autoDeviceIndex;
    const activeDevice = DEVICES[activeDeviceIndex];

    // 4. 解码预警逻辑 (NVDEC)
    const currentPps = cameras * resData.pixels * fps;
    let decodeWarning = null;
    
    if (activeDevice && formatData.hwDecode) {
      if (activeDevice.nvdecPps === 0) {
        decodeWarning = `${activeDevice.name} 不支持硬件解码 (无 NVDEC)，将使用 CPU 解码，可能导致 CPU 满载或严重掉帧。`;
      } else if (currentPps > activeDevice.nvdecPps) {
        const currentMp = (currentPps / 1000000).toFixed(1);
        const limitMp = (activeDevice.nvdecPps / 1000000).toFixed(1);
        decodeWarning = `当前视频流总像素率 (${currentMp} MP/s) 已超过 ${activeDevice.name} 的 NVDEC 硬件解码上限 (${limitMp} MP/s)。`;
      }
    }

    // 5. 负载率与处理时间计算
    const loadPercent = activeDevice ? (requiredTops / activeDevice.tops) * 100 : 0;
    const cvLoadPercent = activeDevice && activeDevice.gflops ? (requiredCvGflops / activeDevice.gflops) * 100 : 0;
    const vramPercent = activeDevice ? (totalVram / activeDevice.ram) * 100 : 0;
    
    // 预估处理延迟 (ms/帧): 
    // AI 推理延迟: 假设满载时处理一帧的时间为 1000/fps，实际延迟与负载率成正比
    const aiLatency = activeDevice ? (loadPercent / 100) * (1000 / fps) : 0;
    
    // CV 算法延迟: 与 CV 负载率成正比
    const cvLatency = activeDevice && activeDevice.gflops ? (cvLoadPercent / 100) * (1000 / fps) : 0;
    
    // 解码与预处理延迟 (受分辨率影响极大)
    // 假设基准 1080P 硬件解码耗时 2ms，软件解码耗时 10ms
    const baseDecodeMs = formatData.hwDecode ? 2 : 10;
    const decodeLatency = (resData.pixels / (1920 * 1080)) * baseDecodeMs * formatData.decodeMultiplier;

    // 总预估延迟
    const estimatedMsPerFrame = aiLatency + cvLatency + decodeLatency;

    // 6. 存储与 I/O 计算
    let requiredThroughput = 0; // MB/s
    let requiredIops = 0;

    if (storageMode === 'VideoStream') {
      // 假设 H.265 编码，0.1 bits per pixel
      const mbpsPerCam = (resData.pixels * fps * 0.1) / 1024 / 1024 / 8;
      requiredThroughput = cameras * mbpsPerCam;
      requiredIops = cameras * (fps / 30); // 连续写入，IOPS 极低，假设每秒 1 次 I/O
    } else if (storageMode === 'FrameImages') {
      // 假设 JPEG 压缩率 10%
      const mbPerFrame = (resData.pixels * 3 * 0.1) / 1024 / 1024;
      requiredThroughput = cameras * mbPerFrame * fps;
      requiredIops = cameras * fps; // 每帧一个文件，高 IOPS
    } else if (storageMode === 'Metadata') {
      // 假设每帧 2KB JSON 数据
      const mbPerFrame = 2 / 1024;
      requiredThroughput = cameras * mbPerFrame * fps;
      requiredIops = cameras * (fps / 10); // 假设批量写入，每 10 帧一次 I/O
    }

    const activeStorage = STORAGE_MEDIUMS[storageMedium];
    const throughputPercent = (requiredThroughput / activeStorage.maxThroughput) * 100;
    const iopsPercent = (requiredIops / activeStorage.maxIops) * 100;

    const isOverloaded = loadPercent > 100 || cvLoadPercent > 100 || vramPercent > 100 || throughputPercent > 100 || iopsPercent > 100;

    return {
      requiredTops,
      requiredCvGflops,
      totalVram,
      baseOsVram,
      modelVram,
      totalStreamVram,
      activeDevice,
      activeDeviceIndex,
      formatData,
      decodeWarning,
      loadPercent,
      cvLoadPercent,
      vramPercent,
      estimatedMsPerFrame,
      requiredThroughput,
      requiredIops,
      activeStorage,
      throughputPercent,
      iopsPercent,
      isOverloaded
    };
  }, [cameras, format, resolution, fps, model, cvAlgo, precision, storageMode, storageMedium, manualDeviceIndex]);

  // 负载条颜色辅助函数
  const getLoadColor = (percent: number) => {
    if (percent < 60) return 'bg-emerald-500';
    if (percent < 85) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getLoadTextColor = (percent: number) => {
    if (percent < 60) return 'text-emerald-400';
    if (percent < 85) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* 顶部导航 */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Cpu className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">嵌入式 AI 算力估算工具</h1>
            <p className="text-xs text-zinc-400">实时视频处理与硬件匹配</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左侧：输入参数 */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 模块一：视频输入参数 (Input) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Video className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-medium">视频输入参数 (Input)</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    摄像头数量：<span className="text-zinc-100 font-semibold">{cameras}</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="16" 
                    value={cameras} 
                    onChange={(e) => setCameras(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>1</span>
                    <span>16</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">视频格式</label>
                    <select 
                      value={format} 
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    >
                      {FORMATS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">分辨率</label>
                    <select 
                      value={resolution} 
                      onChange={(e) => setResolution(e.target.value as keyof typeof RESOLUTIONS)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    >
                      {Object.entries(RESOLUTIONS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">帧率 (FPS)</label>
                  <input 
                    type="number" 
                    min="1" max="120" 
                    value={fps} 
                    onChange={(e) => setFps(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </section>

            {/* 模块二：AI 处理模型 (Processing) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-medium">AI 处理模型 (Processing)</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">模型选择</label>
                  <select 
                    value={model} 
                    onChange={(e) => setModel(e.target.value as keyof typeof MODELS)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                  >
                    {Object.entries(MODELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.name} (~{v.gflops} GFLOPS)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> 传统 CV 算法复杂度
                  </label>
                  <select 
                    value={cvAlgo} 
                    onChange={(e) => setCvAlgo(e.target.value as keyof typeof CV_ALGORITHMS)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                  >
                    {Object.entries(CV_ALGORITHMS).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-2">
                    * 传统算法 (如光流、滤波) 消耗 CPU/GPU 浮点算力 (GFLOPS)，且受分辨率影响极大。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> 推理精度 (Precision)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPrecision('INT8')}
                      className={`py-2 px-4 rounded-lg text-sm font-medium border transition-all ${
                        precision === 'INT8' 
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      INT8 (标准)
                    </button>
                    <button
                      onClick={() => setPrecision('FP16')}
                      className={`py-2 px-4 rounded-lg text-sm font-medium border transition-all ${
                        precision === 'FP16' 
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      FP16 (高精度)
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    * FP16 模式下，等效算力需求将翻倍 (对比设备 INT8 TOPS 指标的 50%)。
                  </p>
                </div>
              </div>
            </section>

            {/* 模块三：存储与 I/O 配置 (Storage) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <HardDrive className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-medium">存储与 I/O 配置 (Storage)</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">数据存储模式</label>
                  <select 
                    value={storageMode} 
                    onChange={(e) => setStorageMode(e.target.value as keyof typeof STORAGE_MODES)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                  >
                    {Object.entries(STORAGE_MODES).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">目标存储介质</label>
                  <select 
                    value={storageMedium} 
                    onChange={(e) => setStorageMedium(e.target.value as keyof typeof STORAGE_MEDIUMS)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all"
                  >
                    {Object.entries(STORAGE_MEDIUMS).map(([k, v]) => (
                      <option key={k} value={k}>{v.name} (最高 {v.maxThroughput} MB/s)</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-2">
                    * 不同的存储介质决定了 I/O 吞吐量和并发写入 (IOPS) 的上限。
                  </p>
                </div>
              </div>
            </section>

          </div>

          {/* 右侧：输出与推荐 */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 模块三：估算结果展示 (Output) */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-lg font-medium mb-6">估算结果展示 (Output)</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Tooltip content={
                  <div className="space-y-2">
                    <h4 className="font-semibold text-emerald-400 border-b border-zinc-700 pb-1">AI 算力 (TOPS)</h4>
                    <p className="text-zinc-300">用于神经网络推理 (如 YOLOv8)。</p>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">公式: (数量 × 帧率 × 单帧 GFLOPS / 1000) × 编解码系数 × 精度系数 × 1.3(冗余)</p>
                    <h4 className="font-semibold text-teal-400 border-b border-zinc-700 pb-1 mt-2">通用算力 (GFLOPS)</h4>
                    <p className="text-zinc-300">用于传统 CV 算法 (如 滤波、光流)。</p>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">公式: 数量 × 帧率 × 基础GFLOPS × 分辨率缩放 × 1.3(冗余)</p>
                  </div>
                }>
                  <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5 relative overflow-hidden group cursor-help">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Zap className="w-16 h-16 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">总算力需求 <Info className="w-3 h-3" /></p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-400">{results.requiredTops.toFixed(1)}</span>
                        <span className="text-xs text-zinc-500 font-mono">TOPS (AI)</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-teal-400">{results.requiredCvGflops.toFixed(1)}</span>
                        <span className="text-xs text-zinc-500 font-mono">GFLOPS (CV)</span>
                      </div>
                    </div>
                  </div>
                </Tooltip>

                <Tooltip content={
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-400 border-b border-zinc-700 pb-1">显存占用计算</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>OS基础:</strong> 1.5 GB</li>
                      <li><strong>模型权重:</strong> {results.modelVram.toFixed(2)} GB (FP16会增加)</li>
                      <li><strong>视频流缓存:</strong> {results.totalStreamVram.toFixed(2)} GB</li>
                    </ul>
                    <p className="text-zinc-400 mt-1">注: 视频流缓存包含解码Buffer、预处理内存和推理激活值，随摄像头数量和分辨率线性增长。</p>
                  </div>
                }>
                  <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5 relative overflow-hidden group cursor-help">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <HardDrive className="w-16 h-16 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">预估显存占用 <Info className="w-3 h-3" /></p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-blue-400">{results.totalVram.toFixed(1)}</span>
                      <span className="text-sm text-zinc-500 font-mono">GB</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      OS({results.baseOsVram.toFixed(1)}) + 模型({results.modelVram.toFixed(1)}) + 流缓存({results.totalStreamVram.toFixed(1)})
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content={
                  <div className="space-y-2">
                    <h4 className="font-semibold text-purple-400 border-b border-zinc-700 pb-1">延迟计算与分辨率影响</h4>
                    <p><strong>总延迟 = AI推理延迟 + CV算法延迟 + 解码预处理延迟</strong></p>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-400 mt-1">
                      <li><strong>AI推理:</strong> 受模型大小影响，输入通常会被缩放至固定尺寸(如640x640)，因此受原图分辨率影响较小。</li>
                      <li><strong>CV算法:</strong> 传统视觉算法(如光流)逐像素处理，耗时随分辨率成正比增加。</li>
                      <li><strong>解码预处理:</strong> 分辨率越高，解码和缩放(Resize)的耗时越长。软解(如Raw/YUV)比硬解(H.264/265)更耗时。</li>
                    </ul>
                  </div>
                }>
                  <div className={`bg-zinc-950 border rounded-xl p-5 relative overflow-hidden group cursor-help ${results.loadPercent > 100 || results.cvLoadPercent > 100 ? 'border-red-900/50' : 'border-zinc-800/50'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Clock className={`w-16 h-16 ${results.loadPercent > 100 || results.cvLoadPercent > 100 ? 'text-red-500' : 'text-purple-500'}`} />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">预估处理延迟 <Info className="w-3 h-3" /></p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${results.loadPercent > 100 || results.cvLoadPercent > 100 ? 'text-red-400' : 'text-purple-400'}`}>
                        {results.estimatedMsPerFrame.toFixed(1)}
                      </span>
                      <span className="text-sm text-zinc-500 font-mono">ms/帧</span>
                    </div>
                    <p className={`text-xs mt-2 ${results.loadPercent > 100 || results.cvLoadPercent > 100 ? 'text-red-400/80' : 'text-zinc-500'}`}>
                      {results.loadPercent > 100 || results.cvLoadPercent > 100 
                        ? `超出实时要求 (需 < ${(1000/fps).toFixed(1)}ms)` 
                        : `满足实时要求 (< ${(1000/fps).toFixed(1)}ms)`}
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content={
                  <div className="space-y-2">
                    <h4 className="font-semibold text-orange-400 border-b border-zinc-700 pb-1">存储吞吐量与 IOPS</h4>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-400 mt-1">
                      <li><strong>视频流:</strong> 连续大块写入，吞吐量低 (H.264/265 压缩后)，IOPS 极低。</li>
                      <li><strong>抽帧图片:</strong> 每帧保存独立 JPEG，吞吐量高，IOPS 极高 (等于总帧率)。</li>
                      <li><strong>元数据:</strong> 保存 JSON 或写入数据库，吞吐量极低，IOPS 视批量写入策略而定。</li>
                    </ul>
                  </div>
                }>
                  <div className={`bg-zinc-950 border rounded-xl p-5 relative overflow-hidden group cursor-help ${results.throughputPercent > 100 || results.iopsPercent > 100 ? 'border-red-900/50' : 'border-zinc-800/50'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <HardDrive className={`w-16 h-16 ${results.throughputPercent > 100 || results.iopsPercent > 100 ? 'text-red-500' : 'text-orange-500'}`} />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">存储吞吐量 & IOPS <Info className="w-3 h-3" /></p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold ${results.throughputPercent > 100 ? 'text-red-400' : 'text-orange-400'}`}>
                          {results.requiredThroughput < 1 && results.requiredThroughput > 0 ? results.requiredThroughput.toFixed(2) : results.requiredThroughput.toFixed(1)}
                        </span>
                        <span className="text-sm text-zinc-500 font-mono">MB/s</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${results.iopsPercent > 100 ? 'text-red-400' : 'text-orange-400'}`}>
                          {Math.ceil(results.requiredIops)}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">IOPS</span>
                      </div>
                    </div>
                  </div>
                </Tooltip>
              </div>
            </section>

            {/* 模块四：设备推荐 (Hardware Matching) */}
            <section className="bg-zinc-900 border border-emerald-900/30 rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-medium">设备推荐 (Hardware Matching)</h2>
                </div>
                {results.activeDevice && (
                  <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 shadow-inner">
                    <span className="text-xs text-zinc-400 font-medium px-2 select-none">切换设备预览:</span>
                    <select 
                      value={results.activeDeviceIndex}
                      onChange={(e) => setManualDeviceIndex(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-zinc-200"
                    >
                      {DEVICES.map((d, i) => (
                        <option key={i} value={i}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {results.activeDevice && (
                <div className="space-y-4">
                  {/* 推荐设备卡片 */}
                  <div className={`border rounded-xl p-6 ${results.isOverloaded ? 'bg-red-950/20 border-red-900/50' : 'bg-emerald-950/20 border-emerald-900/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {results.isOverloaded ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                      <h3 className={`text-xl font-bold ${results.isOverloaded ? 'text-red-50' : 'text-emerald-50'}`}>
                        {results.activeDevice.name}
                        {manualDeviceIndex !== null && <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 align-middle">手动选择</span>}
                      </h3>
                    </div>
                    <p className={`text-sm ${results.isOverloaded ? 'text-red-200/70' : 'text-emerald-200/70'}`}>
                      该设备提供 {results.activeDevice.tops} TOPS (AI) 和 {results.activeDevice.gflops} GFLOPS (CV) 算力，以及 {results.activeDevice.ram}GB 显存。
                      {results.isOverloaded 
                        ? `当前需求已超出该设备或存储的上限，请升级配置或降低处理参数。` 
                        : `能够满足当前计算与 I/O 需求。`}
                    </p>
                  </div>

                  {/* 性能图表 (负载率) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="text-sm font-medium text-zinc-400">AI 算力负载 (TOPS)</h4>
                        <span className={`text-lg font-bold ${getLoadTextColor(results.loadPercent)}`}>
                          {results.loadPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${getLoadColor(results.loadPercent)}`}
                          style={{ width: `${Math.min(100, results.loadPercent)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mt-2">
                        <span>0</span>
                        <span>{results.activeDevice.tops} (Max)</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="text-sm font-medium text-zinc-400">CV 算力负载 (GFLOPS)</h4>
                        <span className={`text-lg font-bold ${getLoadTextColor(results.cvLoadPercent)}`}>
                          {results.cvLoadPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${getLoadColor(results.cvLoadPercent)}`}
                          style={{ width: `${Math.min(100, results.cvLoadPercent)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mt-2">
                        <span>0</span>
                        <span>{results.activeDevice.gflops} (Max)</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="text-sm font-medium text-zinc-400">显存占用率 (VRAM)</h4>
                        <span className={`text-lg font-bold ${getLoadTextColor(results.vramPercent)}`}>
                          {results.vramPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${getLoadColor(results.vramPercent)}`}
                          style={{ width: `${Math.min(100, results.vramPercent)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mt-2">
                        <span>0 GB</span>
                        <span>{results.activeDevice.ram} GB (Max)</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-5">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="text-sm font-medium text-zinc-400">存储 I/O 负载</h4>
                        <span className={`text-lg font-bold ${getLoadTextColor(Math.max(results.throughputPercent, results.iopsPercent))}`}>
                          {Math.max(results.throughputPercent, results.iopsPercent).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${getLoadColor(Math.max(results.throughputPercent, results.iopsPercent))}`}
                          style={{ width: `${Math.min(100, Math.max(results.throughputPercent, results.iopsPercent))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mt-2">
                        <span>0</span>
                        <span>{results.activeStorage.name} (Max)</span>
                      </div>
                    </div>
                  </div>

                  {/* 解码预警 */}
                  {results.decodeWarning && (
                    <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-1">解码能力预警 (NVDEC Limit)</h4>
                        <p className="text-sm text-red-200/80">{results.decodeWarning}</p>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
