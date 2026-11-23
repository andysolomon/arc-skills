// Reproduce: bun install, then bun run render.cjs (from this directory).
const { Resvg } = require('@resvg/resvg-js');
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const ink='#181916', blue='#4050FF', gray='#777971', rule='#D7D9D1', paper='#F8F8F2';
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=30,opts='')=>`<text x="${x}" y="${y}" font-size="${size}" ${opts}>${esc(s)}</text>`;
const mono=(x,y,s,size=18,opts='')=>text(x,y,s,size,`font-family="Courier New" letter-spacing="1.4" ${opts}`);
const serif=(x,y,s,size=36,opts='')=>text(x,y,s,size,`font-family="Georgia" font-style="italic" ${opts}`);
const line=(x1,y1,x2,y2,color=rule,w=2,opts='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" ${opts}/>`;
const arrow=(x1,y1,x2,y2,color=ink)=>line(x1,y1,x2,y2,color,3,`marker-end="url(#${color===blue?'blue':'black'})"`);
const rect=(x,y,w,h,fill='none',stroke=ink)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const center='text-anchor="middle"';
const bold='font-weight="700"';
function wave(x,y,w,h,color=ink,period=7){let d='';for(let i=0;i<=w;i+=3){let a=Math.sin(i/w*Math.PI)**0.6;let yy=y+Math.sin(i/w*Math.PI*period*2)*h*a;d+=`${i?'L':'M'}${x+i},${yy} `;}return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3"/>`;}
function base(n,topic,title,subtitle,body,notes){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><marker id="black" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="${ink}" stroke-width="1.5"/></marker><marker id="blue" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="${blue}" stroke-width="1.5"/></marker></defs>
<rect width="1080" height="1350" fill="${paper}"/><g fill="${ink}" font-family="Arial">
${mono(72,65,'SPEECH / AUDIO')}${mono(1008,65,'FIELD NOTES',18,'text-anchor="end"')}${line(72,101,1008,101)}
${rect(72,132,56,33,blue,blue)}${mono(100,155,n,18,`${center} fill="white"`)}${mono(148,155,topic,18,`fill="${gray}"`)}
${title.map((s,i)=>text(69,246+i*82,s,78,`font-family="Arial" font-weight="700" letter-spacing="-3"`)).join('')}
${serif(72,title.length>1?388:307,subtitle,34)}
${body}
${line(72,1010,1008,1010)}${mono(72,1048,'ENGINEERING NOTE',17,`fill="${blue}"`)}
${notes.map((s,i)=>text(72,1098+i*43,s,30)).join('')}
${line(72,1204,1008,1204,ink,1.5)}${mono(72,1242,'SOURCE / AI ENGINEERING FROM SCRATCH',16)}
${text(72,1282,'aiengineeringfromscratch.com',25,bold)}${mono(1008,1282,`${n} / 03`,18,`text-anchor="end" fill="${blue}"`)}
</g></svg>`;}
const art=fs.readFileSync(path.join(dir,'cover-art.png')).toString('base64');
const cover=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350"><rect width="1080" height="1350" fill="${paper}"/><g fill="${ink}" font-family="Arial">
${mono(72,65,'SPEECH / AUDIO')}${mono(1008,65,'FIELD NOTES — 00',18,'text-anchor="end"')}${line(72,101,1008,101,ink)}
${text(65,235,'From sound',106,`font-weight="900" letter-spacing="-5"`)}${text(65,345,'to conversation.',106,`font-weight="900" letter-spacing="-5"`)}${line(75,376,797,376,blue,10)}
<image x="45" y="412" width="990" height="560" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${art}"/>
${serif(72,1021,'Build the parts.',60)}${serif(72,1094,'Then connect them.',60)}
${text(72,1151,'Signals. Turn-taking. Voice systems.',30)}
${line(72,1204,1008,1204,ink,1.5)}${mono(72,1242,'SOURCE / AI ENGINEERING FROM SCRATCH',16)}${text(72,1282,'Speech & Audio · Phase 06',25,bold)}
</g></svg>`;
let filter='';
// Preserve the low-frequency component across all three transformation stages.
const low=t=>Math.sin(t*Math.PI*4)*33*Math.sin(t*Math.PI)**0.6;
const mixed=t=>low(t)+Math.sin(t*Math.PI*26)*17*Math.sin(t*Math.PI)**0.6;
function signal(y,fn,color){let d='';for(let i=0;i<=342;i+=2)d+=`${i?'L':'M'}${636+i},${y+fn(i/342)} `;return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3"/>`;}
const rows=[{y:475,label:'01 / INPUT',title:'High-rate audio',desc:'Start with the recorded signal.'},{y:652,label:'02 / FILTER',title:'Remove high frequencies',desc:'Use an anti-aliasing low-pass filter.'},{y:829,label:'03 / RESAMPLE',title:'Keep fewer samples',desc:'Match the model’s input rate.'}];
for(const [i,r] of rows.entries()){
filter+=mono(72,r.y,r.label,18,`fill="${i===1?blue:gray}"`)+text(72,r.y+43,r.title,32,bold)+text(72,r.y+80,r.desc,25,`fill="${gray}"`);
filter+=line(628,r.y+37,992,r.y+37,rule,1);
if(i<2)filter+=signal(r.y+37,i?low:mixed,i?blue:ink);
else{for(let k=0;k<=12;k++){let x=636+k*342/12,y=r.y+37+low(k/12);filter+=line(x,r.y+37,x,y,blue,2)+`<circle cx="${x}" cy="${y}" r="5" fill="${blue}"/>`;}}
if(i<2)filter+=arrow(810,r.y+99,810,r.y+140,blue);
}
filter+=mono(1008,975,'SCHEMATIC SIGNALS',15,`text-anchor="end" fill="${gray}"`);
const filtering=base('01','AUDIO FUNDAMENTALS',['Filter before','you downsample.'],'Protect the signal before reducing its rate.',filter,['High frequencies can fold into lower ones.','Filter first to avoid aliasing.']);
let turns=mono(72,470,'ONE UTTERANCE, WITH A PAUSE',18,`fill="${gray}"`);
turns+=line(100,588,980,588,rule,2)+wave(110,588,290,54)+wave(641,588,320,54);
turns+=line(423,588,611,588,blue,4)+text(250,695,'speech',28,center)+text(520,695,'pause',28,`${center} fill="${blue}"`)+text(810,695,'speech',28,center);
turns+=`<path d="M110 720 L110 742 L960 742 L960 720" fill="none" stroke="${blue}" stroke-width="2"/>`+serif(535,791,'Silence alone does not settle the turn.',28,center);
turns+=line(540,845,540,963)+mono(72,876,'VOICE ACTIVITY',18,`fill="${gray}"`)+text(72,924,'“Is this speech?”',32,bold)+mono(593,876,'TURN DETECTION',18,`fill="${blue}"`)+text(593,924,'“Are they done?”',32,bold);
const turnCard=base('02','TURN-TAKING',['A pause is not','a finished thought.'],'Detect speech. Then decide when to respond.',turns,['Combine speech activity with timing and context.','Respond too early, and you cut the speaker off.']);
let interrupt=mono(72,465,'A CASCADED VOICE ASSISTANT',18,`fill="${gray}"`);
const xs=[72,409,746];
const labels=[['TRANSCRIBE','speech → text'],['REASON','language model'],['SPEAK','text → audio']];
xs.forEach((x,i)=>{interrupt+=rect(x,505,262,133)+text(x+131,557,labels[i][0],27,`${center} ${bold}`)+text(x+131,601,labels[i][1],24,center);if(i<2)interrupt+=arrow(x+279,570,x+319,570);});
interrupt+=rect(323,704,434,66,'#E8EAFE',blue)+text(540,747,'USER STARTS SPEAKING',26,`${center} ${bold} fill="${blue}"`);
interrupt+=`<path d="M540 777 L540 805 L275 805 L275 841 M540 805 L805 805 L805 841" fill="none" stroke="${blue}" stroke-width="3" marker-end="url(#blue)"/>`+arrow(275,805,275,841,blue);
interrupt+=text(275,887,'Cancel generation',30,`${center} ${bold}`)+text(805,887,'Stop playback',30,`${center} ${bold}`);
interrupt+=serif(540,966,'Return to listening.',36,`${center} fill="${blue}"`);
const interruptCard=base('03','VOICE SYSTEMS',['Let the user','interrupt.'],'A conversation needs a way to stop.',interrupt,['Handle interruption across the whole pipeline.','Do not keep talking over the next user turn.']);
const cards=[['01-cover',cover],['02-filter-before-downsampling',filtering],['03-turn-taking',turnCard],['04-interruptions',interruptCard]];
const fontDir='/System/Library/Fonts/Supplemental';
const fontFiles=['Arial.ttf','Arial Bold.ttf','Arial Black.ttf','Georgia Italic.ttf','Courier New.ttf'].map(x=>path.join(fontDir,x)).filter(fs.existsSync);
for(const [name,svg] of cards){
 fs.writeFileSync(path.join(dir,name+'.svg'),svg);
 const options={font:{fontFiles,loadSystemFonts:true,defaultFontFamily:'Arial'}};
 fs.writeFileSync(path.join(dir,name+'.png'),new Resvg(svg,options).render().asPng());
 fs.writeFileSync(path.join(dir,name+'-phone.png'),new Resvg(svg,{...options,fitTo:{mode:'width',value:390}}).render().asPng());
 console.log(name+' — 1080 × 1350 PNG + 390 px review');
}
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350">${cards.map(([name],i)=>`<image x="${i%2*540}" y="${Math.floor(i/2)*675}" width="540" height="675" xlink:href="data:image/png;base64,${fs.readFileSync(path.join(dir,name+'.png')).toString('base64')}"/>`).join('')}</svg>`;
fs.writeFileSync(path.join(dir,'preview.png'),new Resvg(sheet).render().asPng());
