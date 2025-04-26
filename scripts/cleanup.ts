/**
 * 清理脚本
 * 用于清理游戏运行过程中产生的临时文件和日志
 */

import * as fs from "fs";
import * as path from "path";

// 需要清理的目录
const CLEANUP_DIRS = [
  "./logs",
  "./tmp",
  "./.cache"
];

// 需要清理的文件扩展名
const CLEANUP_EXTENSIONS = [
  ".log",
  ".tmp",
  ".cache"
];

// 需要保留的文件
const KEEP_FILES = [
  ".gitkeep",
  "README.md"
];

/**
 * 清理指定目录下的文件
 * @param dir 目录路径
 * @param recursive 是否递归清理子目录
 */
function cleanupDirectory(dir: string, recursive: boolean = true): void {
  try {
    // 检查目录是否存在
    if (!fs.existsSync(dir)) {
      console.log(`目录 ${dir} 不存在，跳过清理`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // 如果是目录且需要递归清理
      if (entry.isDirectory() && recursive) {
        cleanupDirectory(fullPath, recursive);
        
        // 如果目录为空，则删除（除非是根目录）
        const dirEntries = fs.readdirSync(fullPath);
        if (dirEntries.length === 0 && !CLEANUP_DIRS.includes(dir)) {
          fs.rmdirSync(fullPath);
          console.log(`删除空目录: ${fullPath}`);
        }
      } 
      // 如果是文件且需要清理
      else if (entry.isFile()) {
        // 检查是否在保留列表中
        if (KEEP_FILES.includes(entry.name)) {
          continue;
        }
        
        // 检查扩展名是否需要清理
        const ext = path.extname(entry.name);
        if (CLEANUP_EXTENSIONS.includes(ext)) {
          fs.unlinkSync(fullPath);
          console.log(`删除文件: ${fullPath}`);
        }
      }
    }
    
    console.log(`目录 ${dir} 清理完成`);
  } catch (error) {
    console.error(`清理目录 ${dir} 时出错:`, error);
  }
}

/**
 * 主函数
 */
function main(): void {
  console.log("开始清理临时文件和日志...");
  
  // 确保清理目录存在
  for (const dir of CLEANUP_DIRS) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`创建目录: ${dir}`);
    }
  }
  
  // 清理每个目录
  for (const dir of CLEANUP_DIRS) {
    cleanupDirectory(dir);
  }
  
  console.log("清理完成！");
}

// 执行主函数
main(); 