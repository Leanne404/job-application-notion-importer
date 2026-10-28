// Executed only after the user clicks the extension action, in the active top frame.
export function capturePage(){
 const selection=window.getSelection()?.toString().trim();
 const root=document.querySelector('main,[role="main"],article')||document.body;
 const selected=Boolean(selection);
 return {url:location.href,title:document.title.slice(0,300),text:(selection||root.innerText||'').slice(0,30000),selected,blocks:[...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,10).map(s=>s.textContent.slice(0,100000))};
}
