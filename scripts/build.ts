/**
 * 构建脚本
 * 用于打包和准备游戏资源
 */

import * as fs from "fs";
import * as path from "path";
import { parse, stringify } from "yaml";

// 目录路径
const CONFIG_DIR = "./config";
const METADATA_DIR = "./config/metadata";
const OUTPUT_DIR = "./dist";
const ASSETS_DIR = "./public";

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
}

// 合并元数据
function mergeMetadata(): any {
  console.log("合并元数据文件...");
  
  const metadata: Record<string, any> = {};
  
  // 读取metadata目录下所有yaml文件
  const files = fs.readdirSync(METADATA_DIR);
  
  for (const file of files) {
    if (path.extname(file) === ".yaml") {
      const filePath = path.join(METADATA_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const data = parse(content);
      
      // 使用文件名作为元数据类别
      const category = path.basename(file, ".yaml");
      metadata[category] = data;
      
      console.log(`处理元数据文件: ${file}`);
    }
  }
  
  return metadata;
}

// 复制资源文件
function copyAssets(): void {
  console.log("复制资源文件...");
  
  const targetDir = path.join(OUTPUT_DIR, "assets");
  ensureDir(targetDir);
  
  // 递归复制函数
  function copyRecursive(src: string, dest: string): void {
    const stats = fs.statSync(src);
    
    if (stats.isDirectory()) {
      ensureDir(dest);
      
      const entries = fs.readdirSync(src);
      for (const entry of entries) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        copyRecursive(srcPath, destPath);
      }
    } else if (stats.isFile()) {
      fs.copyFileSync(src, dest);
      console.log(`复制文件: ${src} -> ${dest}`);
    }
  }
  
  // 开始复制
  if (fs.existsSync(ASSETS_DIR)) {
    copyRecursive(ASSETS_DIR, targetDir);
  } else {
    console.log(`资源目录不存在: ${ASSETS_DIR}`);
  }
}

// 生成游戏数据文件
function generateGameData(metadata: any): void {
  console.log("生成游戏数据文件...");
  
  // 读取world.yaml
  const worldPath = path.join(CONFIG_DIR, "world.yaml");
  const worldData = parse(fs.readFileSync(worldPath, 'utf8'));
  
  // 合并数据
  const gameData = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    world: worldData,
    metadata: metadata
  };
  
  // 写入JSON文件
  const outputPath = path.join(OUTPUT_DIR, "data", "game-data.json");
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(gameData, null, 2));
  console.log(`生成游戏数据文件: ${outputPath}`);
}

/**
 * 主函数
 */
function main(): void {
  console.log("开始构建游戏项目...");
  
  // 确保输出目录存在
  ensureDir(OUTPUT_DIR);
  ensureDir(path.join(OUTPUT_DIR, "data"));
  
  // 合并元数据
  const metadata = mergeMetadata();
  
  // 复制资源文件
  copyAssets();
  
  // 生成游戏数据文件
  generateGameData(metadata);
  
  console.log("构建完成！");
}

// 执行主函数
main(); 