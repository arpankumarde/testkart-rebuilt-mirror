/**
 * Interactive exam content (a calculator, a quiz) runs here and never in the
 * page: a srcdoc iframe sandboxed without allow-same-origin gets an opaque
 * origin, so its scripts cannot read the site's DOM, cookies or storage, and
 * cannot navigate the page. Its own CSP blocks network requests, external
 * scripts and real form submission on top of that. allow-forms is there because
 * a browser fires no submit event in a frame without it, and allow-popups lets
 * links open in a new tab.
 *
 * A plain string, so SSR and the browser agree. The content is escaped into the
 * srcdoc attribute, so it never reaches the page as markup.
 *
 * The frame is transparent and follows the site's theme, so a tool sits in the
 * content card like the text around it. helpers/useHtmlFrame sends it the active
 * theme and colour tokens. Pasted CSS can use `.dark`, `[data-theme]`, the
 * `--tk-*` variables or prefers-color-scheme.
 */

export const HTML_FRAME_CLASS = "tk-html-frame";

const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

const FRAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src https: data:",
  "media-src https:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

// A frame can't size itself to its content, so it reports its height to the page
// and never scrolls vertically. !important stops a pasted min-height: 100vh from
// tying the body to the frame's own height. flow-root keeps the first and last
// margins inside the body, so they count towards the measured height. :where()
// has no specificity, so a layout's own CSS always wins. The system colours are
// for the moment before the page sends its tokens.
const FRAME_BASE_STYLE =
  "html,body{height:auto!important;min-height:0!important}" +
  "html{color-scheme:light dark;background:transparent;overflow-x:auto;overflow-y:hidden!important}" +
  "body{display:flow-root;margin:0;color:var(--tk-foreground,CanvasText);font:16px/1.6 Inter,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;overflow-wrap:break-word}" +
  ":where(img,video,iframe,table,pre,input,select,textarea){max-width:100%}:where(img,video){height:auto}" +
  ":where(input,select,textarea,option){background-color:var(--tk-surface,Canvas);color:var(--tk-foreground,CanvasText)}" +
  ":where(a){color:var(--tk-brand-text,LinkText)}";

// The step check stops a layout that grows with the frame from growing for ever.
// Links open in a new tab.
const FRAME_SCRIPT = `(function(){
var last=0,lastStep=0,streak=0;
function measure(){
var root=document.documentElement,body=document.body;if(!body)return;
var height=body.getBoundingClientRect().bottom+window.scrollY+(parseFloat(getComputedStyle(body).marginBottom)||0);
if(root.scrollHeight>root.clientHeight)height=Math.max(height,root.scrollHeight);
height=Math.ceil(height)+(window.innerHeight-root.clientHeight);
var step=height-last;if(step===0)return;
streak=step>0&&step===lastStep?streak+1:0;lastStep=step;
if(streak>3)return;
last=height;parent.postMessage({tkHtmlFrame:height,tkHtmlFrameWidth:window.innerWidth},"*");
}
function applyTheme(theme){
var root=document.documentElement;
root.setAttribute("data-theme",theme.mode);
root.classList.toggle("dark",theme.mode==="dark");
root.style.colorScheme=theme.mode;
for(var name in theme.tokens)root.style.setProperty("--tk-"+name,theme.tokens[name]);
}
addEventListener("DOMContentLoaded",function(){measure();if(window.ResizeObserver)new ResizeObserver(measure).observe(document.body);});
addEventListener("load",measure);
addEventListener("message",function(e){
if(e.source!==parent||!e.data||!e.data.tkHtmlFrameSync)return;
applyTheme(e.data.tkHtmlFrameSync);last=0;streak=0;measure();
});
document.addEventListener("click",function(e){
var a=e.target&&e.target.closest&&e.target.closest("a[href]");
if(a&&!a.target&&/^https?:/i.test(a.href)){a.target="_blank";a.rel="noopener";}
},true);
})();`;

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The HTML parser folds a pasted <html>, <head> and <body> into this document,
// so a full page and a snippet both work, and nothing pasted can come before the
// CSP. Later CSS wins, so a layout's own styles beat the base style.
export function buildHtmlFrame(html: string): string {
  const document =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>${FRAME_BASE_STYLE}</style><script>${FRAME_SCRIPT}</script></head><body>${html}</body></html>`;
  return `<iframe class="${HTML_FRAME_CLASS}" title="Interactive content" sandbox="${SANDBOX}" srcdoc="${escapeAttribute(document)}"></iframe>`;
}