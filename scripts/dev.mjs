import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './generate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.xml':'application/xml','.txt':'text/plain'};
const port=Number(process.env.PORT || 3000);
createServer(async(req,res)=>{
  const url=new URL(req.url,`http://localhost:${port}`);
  try{
    if(url.pathname.startsWith('/api/')){
      if(!/^\/api\/(create-checkout-session|submit-order|order-status|manage-order|mc-status)$/.test(url.pathname)){res.statusCode=404;res.end();return;}
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>24000){res.statusCode=413;res.end(JSON.stringify({error:'Request too large.'}));return;}}
      req.body=body;req.headers['x-vercel-forwarded-for']=req.socket.remoteAddress;
      const module=await import(`..${url.pathname}.js`);await module.default(req,res);return;
    }
    let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';if(pathname==='/order-status')pathname='/order-status.html';
    // Supports testing deployment under a GitHub repository subdirectory.
    if(pathname.startsWith('/KuroPortfolio/'))pathname=pathname.slice('/KuroPortfolio'.length);
    if(pathname==='/')pathname='/index.html';
    const file=path.resolve(root,`.${pathname}`);
    const relative=path.relative(root,file);const allowed=/^(?:[^/\\]+\.html|(?:css|js|assets)[/\\].+|robots\.txt|sitemap\.xml)$/;
    if(relative.startsWith('..')||!allowed.test(relative))throw new Error('Not public');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Referrer-Policy','no-referrer');res.end(await readFile(file));
  }catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(path.join(root,'404.html')));}
}).listen(port,'127.0.0.1',()=>console.log(`Kuro's Portfolio: http://localhost:${port}`));
