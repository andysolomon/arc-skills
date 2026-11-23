const {Resvg}=require('@resvg/resvg-js');
const fs=require('node:fs'),path=require('node:path');
const out=__dirname;
const C={ink:'#181916',blue:'#4050FF',muted:'#777971',line:'#D7D9D1',paper:'#F8F8F2',tint:'#E8EAFE'};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const t=(x,y,s,size=30,attr='')=>`<text x="${x}" y="${y}" font-size="${size}" ${attr}>${escape(s)}</text>`;
const mono=(x,y,s,size=17,attr='')=>t(x,y,s,size,`font-family="Courier New" letter-spacing="1.3" ${attr}`);
const italic=(x,y,s,size=34,attr='')=>t(x,y,s,size,`font-family="Georgia" font-style="italic" ${attr}`);
const p=(d,color=C.ink,width=2,attr='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attr}/>`;
const line=(x,y,a,b,color=C.line,width=1.5)=>p(`M${x} ${y} L${a} ${b}`,color,width);
const dot=(x,y,r=4,color=C.blue)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const arrow=(d,color=C.blue,width=2.5)=>p(d,color,width,`marker-end="url(#${color===C.blue?'blue':'ink'})"`);
const center='text-anchor="middle"',bold='font-weight="700"';
const data=name=>fs.readFileSync(path.join(out,name)).toString('base64');
const defs=`<defs>${['blue','ink'].map(k=>`<marker id="${k}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="${C[k]}" stroke-width="1.5"/></marker>`).join('')}<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9 L9 0" stroke="${C.ink}" stroke-width="0.6" opacity="0.2"/></pattern></defs>`;
const mast=(n)=>mono(70,64,'SPEECH / AUDIO')+mono(1010,64,`FIELD NOTES — ${n}`,17,'text-anchor="end"')+line(70,98,1010,98,C.ink,1.5);
const foot=(n)=>line(70,1210,1010,1210,C.ink,1.5)+mono(70,1248,'SOURCE / AI ENGINEERING FROM SCRATCH',16)+t(70,1289,'aiengineeringfromscratch.com',25,bold)+mono(1010,1289,`${n} / 03`,18,`text-anchor="end" fill="${C.blue}"`);
function wrap(content){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">${defs}<rect width="1080" height="1350" fill="${C.paper}"/><g fill="${C.ink}" font-family="Arial">${content}</g></svg>`;}
function lesson(n,topic,head,sub,art,notes){return wrap(mast(n)+mono(70,151,`${n} / ${topic}`,18,`fill="${C.blue}"`)+head.map((s,i)=>t(66,239+82*i,s,79,`${bold} letter-spacing="-3"`)).join('')+italic(70,382,sub,33)+art+line(70,1025,1010,1025)+mono(70,1066,'ENGINEERING NOTE',17,`fill="${C.blue}"`)+notes.map((s,i)=>t(70,1115+43*i,s,30)).join('')+foot(n));}
function signal(x,y,w,fn,color=C.ink,width=2.5){let d='';for(let i=0;i<=w;i+=2)d+=`${i?' L':'M'}${x+i} ${y-fn(i/w)}`;return p(d,color,width);}
const speechValue=(u,h)=>h*Math.sin(u*Math.PI)**0.6*(0.5*Math.sin(67*u)+0.3*Math.sin(109*u)+0.2*Math.sin(173*u));
function speech(x,y,w,h,color=C.ink){return signal(x,y,w,u=>speechValue(u,h),color,2.2);}
function looseRule(x,y,w){return p(`M${x} ${y+1} Q${x+w*.35} ${y-1.8} ${x+w*.7} ${y+.8} L${x+w} ${y-.5}`,C.ink,1.4);}

// Cover: the illustration remains unmodified; SVG adds precise explanatory labels.
let cover=mast('00')+t(65,226,'From sound',104,`${bold} letter-spacing="-4.5"`)+t(65,335,'to conversation.',104,`${bold} letter-spacing="-4.5"`);
cover+=p('M75 365 Q430 372 797 365',C.blue,8);
cover+=`<image x="20" y="397" width="650" height="663" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${data('cover-art.png')}"/>`;
cover+=mono(668,481,'01 / CAPTURE',17,`fill="${C.blue}"`)+t(668,525,'Sound',36,bold)+speech(670,574,310,37,C.blue);
cover+=arrow('M827 633 Q838 655 828 675');
cover+=mono(668,719,'02 / REPRESENT',17,`fill="${C.blue}"`)+t(668,763,'Samples',36,bold);
for(let i=0;i<=24;i++){let x=670+i*310/24,y=815-speechValue(i/24,37);cover+=line(x,815,x,y,C.blue,1.5)+dot(x,y,3);}
cover+=arrow('M827 857 Q838 879 828 898');
cover+=mono(668,943,'03 / TRANSCRIBE',17,`fill="${C.blue}"`)+italic(668,997,'“Hello.”',52);
cover+=mono(1007,1046,'ILLUSTRATIVE',14,`text-anchor="end" fill="${C.muted}"`);
cover+=italic(70,1110,'Build the parts. Connect the system.',44)+t(70,1164,'Signals. Turn-taking. Voice systems.',30)+foot('00');

// Three aligned signal strips use the same underlying slow component.
const slow=u=>35*Math.sin(u*Math.PI*5)*Math.sin(u*Math.PI)**0.5;
const fast=u=>17*Math.sin(u*Math.PI*43)*Math.sin(u*Math.PI)**0.5;
let filter='';
const stages=[{y:500,label:'01   RECORDED SIGNAL',fn:u=>slow(u)+fast(u),color:C.ink},{y:699,label:'02   AFTER LOW-PASS FILTER',fn:slow,color:C.blue},{y:888,label:'03   FEWER SAMPLES',fn:slow,color:C.blue}];
for(const [i,s] of stages.entries()){
 filter+=mono(88,s.y-62,s.label,18,`fill="${i?C.blue:C.muted}"`);
 filter+=`<path d="M78 ${s.y-38} L78 ${s.y+57} L928 ${s.y+54} L928 ${s.y-37}" fill="none" stroke="${C.line}" stroke-width="1"/>`;
 filter+=line(96,s.y,908,s.y,C.line,1);
 if(i<2)filter+=signal(105,s.y,790,s.fn,s.color,2.5);
 else for(let k=0;k<=24;k++){let x=105+k*790/24,y=s.y-slow(k/24);filter+=line(x,s.y,x,y,C.blue,1.6)+dot(x,y,4);}
 filter+=`<path d="M78 ${s.y+57} L92 ${s.y+70} L938 ${s.y+67} L928 ${s.y+54} Z" fill="url(#hatch)"/>`;
 if(i<2)filter+=arrow(`M961 ${s.y+17} C990 ${s.y+40} 990 ${s.y+122} 960 ${s.y+145}`);
}
filter+=italic(110,611,'Remove the fast component.',28)+italic(110,800,'Keep the same slow wave.',28)+mono(1008,994,'SCHEMATIC / NOT MEASURED AUDIO',15,`text-anchor="end" fill="${C.muted}"`);
const filterCard=lesson('01','AUDIO FUNDAMENTALS',['Filter before','you downsample.'],'Protect the signal before reducing its rate.',filter,['High frequencies can fold into lower ones.','Filter first to avoid aliasing.']);

// The pause is a visible piece of an unfinished spoken phrase.
let turn=italic(85,498,'“Could you…',42)+italic(579,498,'move it to Friday?”',42);
turn+=`<rect x="431" y="540" width="140" height="169" fill="${C.tint}"/>`;
turn+=line(87,620,995,620,C.line,1)+speech(90,620,323,63)+speech(595,620,400,65);
turn+=p('M435 620 Q500 622 568 620',C.blue,4)+mono(501,684,'PAUSE',20,`${center} fill="${C.blue}"`);
turn+=arrow('M697 756 C669 757 591 751 550 710')+italic(700,768,'Still thinking.',32,`fill="${C.blue}"`);
turn+=p('M90 730 L90 802 Q322 806 501 803 Q746 801 995 805 L995 734',C.ink,1.5)+italic(90,856,'One thought can contain silence.',33);
turn+=line(546,894,546,987)+mono(88,924,'SPEECH DETECTION',17,`fill="${C.muted}"`)+t(88,972,'“Is this speech?”',32,bold)+mono(591,924,'TURN DETECTION',17,`fill="${C.blue}"`)+t(591,972,'“Are they done?”',32,bold);
const turnCard=lesson('02','TURN-TAKING',['A pause is not','a finished thought.'],'Use timing and context before replying.',turn,['Combine speech activity with timing and context.','Respond too early, and you cut the speaker off.']);

// A visibly interrupted playback trace replaces the generic pipeline boxes.
let stop=mono(88,463,'ASSISTANT PLAYBACK',18,`fill="${C.muted}"`);
stop+=looseRule(88,491,902)+looseRule(88,670,902)+speech(104,581,510,65);
stop+=`<rect x="650" y="508" width="334" height="143" fill="url(#hatch)"/>`+line(650,581,984,581,C.muted,1);
stop+=p('M621 501 Q635 579 618 661',C.blue,5)+dot(624,581,7);
stop+=italic(821,715,'Playback stops.',31,`${center} fill="${C.blue}"`);
stop+=speech(90,808,350,48,C.blue)+mono(90,887,'USER STARTS SPEAKING',19,`fill="${C.blue}"`)+arrow('M470 807 C574 800 653 740 629 638',C.blue,3);
stop+=t(88,976,'Cancel generation.',32,bold)+t(590,976,'Return to listening.',32,bold);
const stopCard=lesson('03','VOICE SYSTEMS',['Let the user','interrupt.'],'A conversation needs a way to stop.',stop,['Stop playback and cancel the pending response.','Listen to the next user turn.']);

const cards=[['01-cover',wrap(cover)],['02-filter-before-downsampling',filterCard],['03-turn-taking',turnCard],['04-interruptions',stopCard]];
const fontFiles=['Arial.ttf','Arial Bold.ttf','Georgia Italic.ttf','Courier New.ttf'].map(n=>'/System/Library/Fonts/Supplemental/'+n).filter(fs.existsSync);
const font={fontFiles,loadSystemFonts:true,defaultFontFamily:'Arial'};
for(const [name,svg] of cards){fs.writeFileSync(path.join(out,name+'.svg'),svg);fs.writeFileSync(path.join(out,name+'.png'),new Resvg(svg,{font}).render().asPng());fs.writeFileSync(path.join(out,name+'-phone.png'),new Resvg(svg,{font,fitTo:{mode:'width',value:390}}).render().asPng());console.log(name);}
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1104" height="1374"><rect width="1104" height="1374" fill="#D7D9D1"/>${cards.map(([name],i)=>`<image x="${8+i%2*548}" y="${8+Math.floor(i/2)*683}" width="540" height="675" xlink:href="data:image/png;base64,${data(name+'.png')}"/>`).join('')}</svg>`;
fs.writeFileSync(path.join(out,'preview.png'),new Resvg(sheet).render().asPng());
