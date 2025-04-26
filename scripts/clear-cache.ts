// AI缓存清理脚本
import { ensureDir } from "https://deno.land/std@0.196.0/fs/mod.ts";

const CACHE_DIR = "./cache";
const CACHE_FILE = `${CACHE_DIR}/ai_response_cache.json`;

// 确保目录存在
await ensureDir(CACHE_DIR);
console.log("缓存目录已检查");

try {
  // 检查文件是否存在
  await Deno.stat(CACHE_FILE);
  
  // 删除缓存文件
  await Deno.remove(CACHE_FILE);
  console.log(`已删除缓存文件: ${CACHE_FILE}`);
} catch (error: unknown) {
  if (error instanceof Deno.errors.NotFound) {
    console.log(`缓存文件不存在: ${CACHE_FILE}`);
  } else {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`清理缓存时出错: ${err.message}`);
    Deno.exit(1);
  }
}

// 创建空的缓存文件
await Deno.writeTextFile(CACHE_FILE, JSON.stringify({}));
console.log("已创建新的空缓存文件");

console.log("缓存清理完成"); 