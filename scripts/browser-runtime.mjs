import { chromium as playwright } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { existsSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createBrotliDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar-fs';
export async function launchBrowser(){
 if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)return playwright.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox']});
 if(process.platform!=='linux')return playwright.launch({headless:true});
 // The npm-distributed browser avoids a separate browser download. Supply its
 // packaged NSS libraries on minimal Linux hosts that don't have system NSS.
 const directory=join(tmpdir(),'alpine-chromium-libraries');
 if(!existsSync(join(directory,'lib/libnspr4.so'))){const root=dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium')));await pipeline(createReadStream(join(root,'../bin/al2023.tar.br')),createBrotliDecompress(),extract(directory));}
 process.env.LD_LIBRARY_PATH=[join(directory,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
 return playwright.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--enable-webgl','--enable-unsafe-swiftshader'],headless:true});
}
