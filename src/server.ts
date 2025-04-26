// 尝试加载环境变量文件
try {
  console.log("尝试加载.env环境变量文件...");
  await import("std/dotenv/load.ts").catch(() => {
    console.log("未找到标准dotenv模块，尝试替代模块...");
    import("https://deno.land/x/dotenv@v3.2.2/mod.ts");
  });
  console.log("环境变量已加载");
} catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));
  console.log(`未找到.env文件或加载失败，将使用系统环境变量: ${error.message}`);
}

import { Application } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import router from "./router.ts";
import { hasAvailableService, getAvailableServices } from "./ai/config.ts";

// 显示环境信息
console.log("======================================");
console.log("埃尔德拉编年史 - 服务启动");
console.log(`运行环境: ${Deno.build.os} ${Deno.build.arch}`);
console.log(`Deno版本: ${Deno.version.deno}`);
console.log("AI服务状态:");
try {
  const available = hasAvailableService();
  const services = getAvailableServices();
  console.log(`- 可用状态: ${available ? "已配置" : "未配置"}`);
  console.log(`- 可用服务: ${services.length > 0 ? services.join(", ") : "无"}`);
} catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));
  console.log(`- 检查失败: ${error.message}`);
}
console.log("======================================");

// 创建应用实例
const app = new Application();

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`服务器错误: ${error.message}`);
    console.error(error.stack);
    
    // 确保类型安全
    const status = error instanceof Deno.errors.NotFound ? 404 : 
                  "status" in error && typeof error.status === "number" ? error.status : 
                  500;
                  
    const message = "expose" in error && error.expose === true ? error.message : "服务器内部错误";
    const code = "code" in error && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
    
    ctx.response.status = status;
    ctx.response.body = { 
      success: false, 
      message,
      code
    };
  }
});

// 记录请求中间件
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} - ${ms}ms`);
});

// CORS 支持
app.use(oakCors());

// 路由
app.use(router.routes());
app.use(router.allowedMethods());

// 静态文件服务
import { send } from "https://deno.land/x/oak/mod.ts";
app.use(async (ctx, next) => {
  try {
    // 尝试提供静态文件
    if (ctx.request.url.pathname.startsWith("/images/")) {
      await send(ctx, ctx.request.url.pathname, {
        root: `${Deno.cwd()}`,
      });
      return;
    }
    
    if (ctx.request.url.pathname === "/" || 
        ctx.request.url.pathname.match(/\.(html|css|js)$/)) {
      await send(ctx, ctx.request.url.pathname === "/" ? "/public/index.html" : ctx.request.url.pathname, {
        root: `${Deno.cwd()}`,
      });
      return;
    }
    
    await next();
  } catch {
    await next();
  }
});

// 404 处理
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { success: false, message: "页面未找到" };
});

// 启动服务器
const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`服务器启动在 http://localhost:${port}`);

try {
  await app.listen({ port });
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`服务器启动失败: ${error.message}`);
  Deno.exit(1);
}