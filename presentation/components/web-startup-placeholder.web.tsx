import {PRIVACY_NOTICE_VERSION} from '@/domain';
import {Colors} from '../constants/theme';

export function getWebStartupScript(baseUrl: string) {
    return `(function(){try{
if(window.location.pathname.replace(/\\/+$/,'')!==${JSON.stringify(baseUrl.replace(/\/+$/, ''))})return;
var choice=JSON.parse(localStorage.getItem('privacy:choices')||'null');
if(!choice||typeof choice!=='object'||Array.isArray(choice)||choice.adultConfirmed!==true||
choice.noticeVersion!==${JSON.stringify(PRIVACY_NOTICE_VERSION)}||typeof choice.analytics!=='boolean'||
typeof choice.youtube!=='boolean'||typeof choice.updatedAt!=='string'||
!Number.isFinite(Date.parse(choice.updatedAt))||new Date(choice.updatedAt).toISOString()!==choice.updatedAt)return;
var root=document.documentElement;
var theme=localStorage.getItem('settings:theme');
if(theme!=='light'&&theme!=='system')theme='dark';
root.setAttribute('data-yify-startup-theme',theme);
root.setAttribute('data-yify-startup','pending');
var timer=setTimeout(function(){if(root.hasAttribute('data-yify-startup'))root.setAttribute('data-yify-startup','failed');},12000);
window.addEventListener('yify:startup-ready',function(){clearTimeout(timer);root.removeAttribute('data-yify-startup');root.removeAttribute('data-yify-startup-theme');},{once:true});
}catch{}})();`;
}

export function clearWebStartupPlaceholder() {
    if (typeof document === 'undefined') return;
    window.dispatchEvent(new Event('yify:startup-ready'));
    document.documentElement.removeAttribute('data-yify-startup');
    document.documentElement.removeAttribute('data-yify-startup-theme');
}

const CSS = `
#yify-startup{display:none}
html[data-yify-startup] #root{display:none}
html[data-yify-startup] #yify-startup{display:block}
#yify-startup{--background:${Colors.dark.background};--block:${Colors.dark.surfaceElevated};--text:${Colors.dark.text};--accent:${Colors.dark.accent};--gutter:16px;--top:108px;--hero:548px;position:fixed;inset:0;overflow:hidden;background:var(--background);color:var(--text);font-family:system-ui,sans-serif}
html[data-yify-startup-theme="light"] #yify-startup{--background:${Colors.light.background};--block:${Colors.light.surfaceSunken};--text:${Colors.light.text};--accent:${Colors.light.accent}}
@media(prefers-color-scheme:light){html[data-yify-startup-theme="system"] #yify-startup{--background:${Colors.light.background};--block:${Colors.light.surfaceSunken};--text:${Colors.light.text};--accent:${Colors.light.accent}}}
#yify-startup *{box-sizing:border-box}
#yify-startup .block{background:var(--block);border-radius:8px}
#yify-startup .top{height:var(--top);padding:16px var(--gutter);display:flex;align-items:flex-start;justify-content:space-between}
#yify-startup .brand{width:72px;height:32px}
#yify-startup .navigation{width:45%;max-width:320px;height:32px}
#yify-startup .hero{padding:20px var(--gutter);display:flex;flex-direction:column;gap:24px;min-height:calc(var(--hero) - 54px)}
#yify-startup .art{width:100%;aspect-ratio:16/9}
#yify-startup .copy{width:100%}
#yify-startup .title{width:90%;height:94px}
#yify-startup .meta{width:60%;height:20px;margin-top:16px}
#yify-startup .detail{width:40%;height:18px;margin-top:8px}
#yify-startup .description{width:95%;max-width:520px;height:69px;margin-top:18px}
#yify-startup .actions{display:flex;gap:8px;margin-top:24px}
#yify-startup .button{width:140px;height:46px;border-radius:12px}
#yify-startup .square{width:46px;height:46px;border-radius:12px}
#yify-startup .selector{height:54px;margin:0 var(--gutter) 32px;display:flex;align-items:center;justify-content:space-between;gap:12px}
#yify-startup .thumbnails{flex:1;max-width:270px;height:46px}
#yify-startup .rail{padding:0 var(--gutter)}
#yify-startup .rail-title{width:145px;height:28px;margin-bottom:20px}
#yify-startup .posters{display:flex;gap:12px}
#yify-startup .poster{flex:0 0 220px;height:124px;border-radius:12px}
#yify-startup .failure{display:none;max-width:560px;margin:auto;padding:32px;line-height:1.6}
#yify-startup .failure h1{font:600 28px/1.3 Georgia,serif;margin:0 0 16px}
#yify-startup .failure a{color:var(--accent);display:inline-block;padding:12px 0;margin-right:24px}
#yify-startup .failure a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
html[data-yify-startup="failed"] #yify-startup{overflow:auto}
html[data-yify-startup="failed"] #yify-startup .pending{display:none}
html[data-yify-startup="failed"] #yify-startup .failure{display:block;padding-top:max(48px,20vh)}
@media(min-width:520px){#yify-startup{--top:64px}}
@media(min-width:600px){#yify-startup{--gutter:24px;--hero:588px}}
@media(min-width:760px){#yify-startup .hero{--gap:32px;flex-direction:row;align-items:center;gap:var(--gap);padding-top:40px;padding-bottom:8px}#yify-startup .copy{width:calc((100% - var(--gap)) * .44)}#yify-startup .art{width:calc((100% - var(--gap)) * .56);order:1}#yify-startup .title{height:110px}}
@media(min-width:1024px){#yify-startup{--gutter:32px;--hero:clamp(428px,calc(68vh - 32px),528px)}#yify-startup .poster{flex-basis:272px;height:153px}}
@media(min-width:1064px){#yify-startup .hero{--gap:48px}}
@media(min-width:1090px){#yify-startup .title{height:142px}}
`;

export function WebStartupPlaceholder({baseUrl}: {baseUrl: string}) {
    return <>
        <style dangerouslySetInnerHTML={{__html: CSS}}/>
        <div id="yify-startup">
            <div className="pending" aria-hidden="true">
                <div aria-hidden="true">
                    <div className="top"><div className="block brand"/><div className="block navigation"/></div>
                    <div className="hero">
                        <div className="block art"/>
                        <div className="copy">
                            <div className="block title"/><div className="block meta"/><div className="block detail"/>
                            <div className="block description"/>
                            <div className="actions"><div className="block button"/><div className="block square"/></div>
                        </div>
                    </div>
                    <div className="selector"><div className="block square"/><div className="block thumbnails"/><div className="block square"/></div>
                    <div className="rail"><div className="block rail-title"/>
                        <div className="posters">{Array.from({length: 8}, (_, index) => <div className="block poster" key={index}/>)}</div>
                    </div>
                </div>
            </div>
            <div className="failure" role="status">
                <h1>Taking longer than usual</h1>
                <p>Reload the page to try again.</p>
                <a href="">Reload page</a><a href={`${baseUrl}/privacy/`}>Privacy policy</a><a href={`${baseUrl}/guide/`}>How Yify works</a>
            </div>
        </div>
    </>;
}
