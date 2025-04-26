/**
 * 数据验证脚本
 * 用于检查元数据的正确性和完整性
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";

// 目录路径
const METADATA_DIR = "./config/metadata";

// 错误和警告计数
let errorCount = 0;
let warningCount = 0;

/**
 * 打印错误消息
 * @param message 错误消息
 * @param file 相关文件
 * @param item 相关项目
 */
function reportError(message: string, file: string, item?: any): void {
  console.error(`错误: ${message}`);
  if (file) console.error(`文件: ${file}`);
  if (item) console.error(`项目: ${JSON.stringify(item, null, 2)}`);
  console.error('---');
  errorCount++;
}

/**
 * 打印警告消息
 * @param message 警告消息
 * @param file 相关文件
 * @param item 相关项目
 */
function reportWarning(message: string, file: string, item?: any): void {
  console.warn(`警告: ${message}`);
  if (file) console.warn(`文件: ${file}`);
  if (item) console.warn(`项目: ${JSON.stringify(item, null, 2)}`);
  console.warn('---');
  warningCount++;
}

/**
 * 验证引用的完整性，检查一个文件中的引用是否在另一个文件中存在
 * @param sourceFile 源文件名
 * @param sourceField 源字段名
 * @param targetFile 目标文件名
 * @param targetField 目标字段名
 */
function validateReferences(sourceFile: string, sourceField: string, targetFile: string, targetField: string): void {
  console.log(`验证引用: ${sourceFile}[${sourceField}] -> ${targetFile}[${targetField}]`);
  
  // 读取源文件和目标文件
  const sourcePath = path.join(METADATA_DIR, `${sourceFile}.yaml`);
  const targetPath = path.join(METADATA_DIR, `${targetFile}.yaml`);
  
  if (!fs.existsSync(sourcePath)) {
    reportError(`源文件不存在: ${sourcePath}`, sourcePath);
    return;
  }
  
  if (!fs.existsSync(targetPath)) {
    reportError(`目标文件不存在: ${targetPath}`, targetPath);
    return;
  }
  
  const sourceData = parse(fs.readFileSync(sourcePath, 'utf8'));
  const targetData = parse(fs.readFileSync(targetPath, 'utf8'));
  
  // 从目标文件中提取所有有效ID
  const validIds = new Set<string>();
  for (const item of targetData) {
    if (item && item[targetField]) {
      validIds.add(item[targetField]);
    } else {
      reportError(`目标项缺少必要字段: ${targetField}`, targetPath, item);
    }
  }
  
  // 验证源文件中的引用
  for (const item of sourceData) {
    if (!item) continue;
    
    // 检查字段是否存在
    const fieldValue = item[sourceField];
    if (!fieldValue) continue; // 可选字段，跳过
    
    // 如果是数组，检查每个元素
    if (Array.isArray(fieldValue)) {
      for (const id of fieldValue) {
        if (!validIds.has(id)) {
          reportError(`无效的引用: ${id}`, sourcePath, item);
        }
      }
    } 
    // 如果是单一值，直接检查
    else if (!validIds.has(fieldValue)) {
      reportError(`无效的引用: ${fieldValue}`, sourcePath, item);
    }
  }
}

/**
 * 验证一个YAML文件中的必要字段
 * @param filename 文件名
 * @param requiredFields 必要字段列表
 */
function validateRequiredFields(filename: string, requiredFields: string[]): void {
  console.log(`验证必要字段: ${filename}`);
  
  const filePath = path.join(METADATA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    reportError(`文件不存在: ${filePath}`, filePath);
    return;
  }
  
  const data = parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const item of data) {
    if (!item) continue;
    
    for (const field of requiredFields) {
      if (item[field] === undefined) {
        reportError(`缺少必要字段: ${field}`, filePath, item);
      }
    }
  }
}

/**
 * 验证字段值的唯一性
 * @param filename 文件名
 * @param uniqueFields 需要唯一值的字段列表
 */
function validateUniqueFields(filename: string, uniqueFields: string[]): void {
  console.log(`验证字段唯一性: ${filename}`);
  
  const filePath = path.join(METADATA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    reportError(`文件不存在: ${filePath}`, filePath);
    return;
  }
  
  const data = parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const field of uniqueFields) {
    const values = new Map<string, any>();
    
    for (const item of data) {
      if (!item || item[field] === undefined) continue;
      
      const value = item[field];
      
      if (values.has(value)) {
        reportError(`重复的字段值: ${field}=${value}`, filePath, item);
      } else {
        values.set(value, item);
      }
    }
  }
}

/**
 * 验证所有元数据文件
 */
function validateAllMetadata(): void {
  // 验证必要字段
  validateRequiredFields("locations.yaml", ["id", "name", "type", "description"]);
  validateRequiredFields("npcs.yaml", ["id", "name", "race", "profession"]);
  validateRequiredFields("items.yaml", ["id", "name", "type", "description"]);
  validateRequiredFields("events.yaml", ["id", "name", "description"]);
  validateRequiredFields("regions.yaml", ["id", "name", "description"]);
  
  // 验证唯一字段
  validateUniqueFields("locations.yaml", ["id"]);
  validateUniqueFields("npcs.yaml", ["id"]);
  validateUniqueFields("items.yaml", ["id"]);
  validateUniqueFields("events.yaml", ["id"]);
  validateUniqueFields("regions.yaml", ["id"]);
  
  // 验证引用关系
  validateReferences("locations", "region", "regions", "id");
  validateReferences("locations", "connections", "locations", "id");
  validateReferences("npcs", "possessions", "items", "id");
}

/**
 * 主函数
 */
function main(): void {
  console.log("开始验证元数据...");
  
  validateAllMetadata();
  
  console.log("验证完成！");
  console.log(`错误: ${errorCount}`);
  console.log(`警告: ${warningCount}`);
  
  // 如果有错误，返回非零状态码
  if (errorCount > 0) {
    console.error("验证失败！");
    Deno.exit(1);
  }
}

// 执行主函数
main(); 