(() => {
  const STORAGE_KEY='siteforge-v2-project';
  const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const canvas=$('#canvas'), inspector=$('#inspector'), selectionLabel=$('#selectionLabel'), deleteBtn=$('#deleteBtn'), pageFrame=$('#pageFrame');
  const uid=()=> 'sf-'+Math.random().toString(36).slice(2,10);
  let selectedId=null, undoStack=[], redoStack=[];
  let project=load()||starterProject();

  function baseStyle(){return {width:100,maxWidth:0,minHeight:0,paddingX:0,paddingY:0,marginTop:0,marginBottom:0,gap:0,bg:'#ffffff',color:'#17120e',radius:0,borderWidth:0,borderColor:'#dddddd',shadow:0,fontSize:16,fontWeight:400,lineHeight:1.45,align:'left',columns:2,objectFit:'cover',objectPosition:'50% 50%',css:'',tabletCss:'',mobileCss:''}}
  function make(type,overrides={}){
    const presets={
      section:{style:{paddingX:24,paddingY:36,bg:'#ffffff'},children:[]},
      container:{style:{maxWidth:1180,paddingX:0,paddingY:0},children:[]},
      grid:{style:{columns:3,gap:18},children:[]},
      card:{style:{paddingX:18,paddingY:18,bg:'#ffffff',radius:10,borderWidth:1,borderColor:'#e7e0d7'},children:[]},
      heading:{text:'Your headline',tag:'h2',style:{fontSize:42,fontWeight:800,lineHeight:1.05}},
      text:{text:'Add your text here.',tag:'p',style:{fontSize:16,lineHeight:1.55}},
      button:{text:'Button',href:'#',style:{width:0,paddingX:18,paddingY:11,bg:'#8b5a2b',color:'#ffffff',radius:6,fontWeight:700}},
      image:{src:'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80',alt:'Website image',style:{minHeight:260,radius:8,objectFit:'cover'}},
      spacer:{style:{minHeight:32}}, divider:{style:{minHeight:1,bg:'#ded7ce'}}
    };
    const p=presets[type]||{};
    const n={id:uid(),type,...p,...overrides,style:{...baseStyle(),...(p.style||{}),...(overrides.style||{})}};
    if(['section','container','grid','card'].includes(type)) n.children=overrides.children||p.children||[];
    return n;
  }
  function starterProject(){return {version:2,title:'My First Site',device:'desktop',page:{bg:'#ffffff',maxWidth:1440,css:''},globalCss:'',elements:[make('section',{children:[make('container',{children:[make('heading',{text:'Build something worth keeping.'}),make('text',{text:'SiteForge V2 gives you nested sections, grids, cards, exact CSS, and responsive overrides.'}),make('button',{text:'Start editing'})]})]})]}}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(project));$('#saveState').textContent='Saved locally'}
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))}catch{return null}}
  function snapshot(){undoStack.push(JSON.stringify(project));if(undoStack.length>80)undoStack.shift();redoStack=[];updateUndoButtons()}
  function updateUndoButtons(){$('#undoBtn').disabled=!undoStack.length;$('#redoBtn').disabled=!redoStack.length}
  function normalizeProject(data){
    if(data.version===2&&Array.isArray(data.elements))return data;
    if(Array.isArray(data.elements)) return {version:2,title:data.title||'Imported SiteForge project',device:data.device||'desktop',page:{bg:'#ffffff',maxWidth:1440,css:''},globalCss:'',elements:data.elements.map(old=>make(old.type,{...old,style:{...baseStyle(),...(old.style||{})}}))};
    throw new Error('Invalid project');
  }
  function commit(fn){snapshot();fn();render();save()}
  function walk(nodes=project.elements,parent=null,cb=()=>{}){for(let i=0;i<nodes.length;i++){const n=nodes[i];cb(n,parent,nodes,i);if(n.children)walk(n.children,n,cb)}}
  function findNode(id){let out=null;walk(project.elements,null,(n,p,list,i)=>{if(n.id===id)out={node:n,parent:p,list,index:i}});return out}
  function acceptsChildren(n){return n&&['section','container','grid','card'].includes(n.type)}

  function styleString(n){const s=n.style||{}, a=[];const add=(k,v)=>{if(v!==undefined&&v!==null&&v!=='')a.push(`${k}:${v}`)};
    if(s.width>0)add('width',s.width+'%'); if(s.maxWidth>0){add('max-width',s.maxWidth+'px');add('margin-left','auto');add('margin-right','auto')}
    if(s.minHeight>0)add('min-height',s.minHeight+'px'); if(s.paddingX||s.paddingY)add('padding',`${s.paddingY||0}px ${s.paddingX||0}px`);
    if(s.marginTop)add('margin-top',s.marginTop+'px'); if(s.marginBottom)add('margin-bottom',s.marginBottom+'px');
    if(s.gap)add('gap',s.gap+'px'); if(s.bg)add('background',s.bg); if(s.color)add('color',s.color); if(s.radius)add('border-radius',s.radius+'px');
    if(s.borderWidth)add('border',`${s.borderWidth}px solid ${s.borderColor||'#ddd'}`); if(s.shadow)add('box-shadow',`0 ${Math.round(s.shadow*.45)}px ${Math.round(s.shadow*1.8)}px rgba(0,0,0,.18)`);
    if(['heading','text','button'].includes(n.type)){add('font-size',s.fontSize+'px');add('font-weight',s.fontWeight);add('line-height',s.lineHeight);add('text-align',s.align)}
    if(n.type==='grid'){add('display','grid');add('grid-template-columns',`repeat(${Math.max(1,s.columns||2)},minmax(0,1fr))`)}
    if(n.type==='image'){add('object-fit',s.objectFit);add('object-position',s.objectPosition);add('width','100%'); if(s.minHeight>0)add('height',s.minHeight+'px')}
    if(n.type==='button'){add('display','inline-flex');add('align-items','center');add('justify-content','center');add('text-decoration','none')}
    if(s.css)a.push(s.css.trim().replace(/^;+|;+$/g,'')); return a.join(';');
  }
  function createNode(n){
    let el;if(n.type==='section')el=document.createElement('section');else if(['container','grid','card','spacer','divider'].includes(n.type))el=document.createElement('div');else if(n.type==='heading')el=document.createElement(n.tag||'h2');else if(n.type==='text')el=document.createElement(n.tag||'p');else if(n.type==='button')el=document.createElement('a');else if(n.type==='image')el=document.createElement('img');else el=document.createElement('div');
    el.className=`sf-node sf-${n.type}`;el.dataset.id=n.id;el.style.cssText=styleString(n);
    if(n.id===selectedId)el.classList.add('selected');
    if(n.type==='heading'||n.type==='text')el.textContent=n.text||'';
    if(n.type==='button'){el.textContent=n.text||'';el.href=n.href||'#';el.addEventListener('click',e=>e.preventDefault())}
    if(n.type==='image'){el.src=n.src||'';el.alt=n.alt||''}
    if(n.children){if(n.children.length)n.children.forEach(c=>el.appendChild(createNode(c)));else{const empty=document.createElement('div');empty.className='empty-drop';empty.textContent='Empty '+n.type+' — select it, then add elements';el.appendChild(empty)}}
    el.addEventListener('click',e=>{e.stopPropagation();selectedId=n.id;renderSelection();$$('.sf-node',canvas).forEach(x=>x.classList.toggle('selected',x.dataset.id===selectedId))});
    if(['heading','text','button'].includes(n.type))el.addEventListener('dblclick',e=>{e.stopPropagation();inlineEdit(el,n)});
    return el;
  }
  function render(){project=$.structuredClone?project:project;$('#projectTitle').value=project.title||'Untitled Site';canvas.innerHTML='';canvas.style.background=project.page?.bg||'#fff';canvas.style.maxWidth=(project.page?.maxWidth||1440)+'px';canvas.style.margin='0 auto';if(project.page?.css)canvas.style.cssText += ';'+project.page.css;project.elements.forEach(n=>canvas.appendChild(createNode(n)));setDevice(project.device||'desktop',false);renderSelection();updateUndoButtons()}
  function renderSelection(){const f=findNode(selectedId);if(!f){selectionLabel.textContent='Nothing selected';deleteBtn.disabled=true;inspector.className='inspector-empty';inspector.innerHTML='<div class="empty-graphic">◇</div><h3>Select an element</h3><p>Adjust content, layout, appearance, and exact responsive CSS.</p>';return}const n=f.node;deleteBtn.disabled=false;selectionLabel.textContent=n.type[0].toUpperCase()+n.type.slice(1);inspector.className='inspector-body';inspector.innerHTML=inspectorMarkup(n);bindInspector(n)}
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'), attr=s=>esc(s).replace(/"/g,'&quot;');
  const slider=(label,key,val,min,max,suffix='px',step=1)=>`<div class="field"><label>${label}</label><div class="slider-row"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-style="${key}"><output data-out="${key}">${val}${suffix}</output></div></div>`;
  const color=(label,key,val)=>`<div class="field"><label>${label}</label><input class="color-input" type="color" value="${val}" data-style="${key}"></div>`;
  const group=(t,b)=>`<section class="inspector-group"><h3>${t}</h3>${b}</section>`;
  function inspectorMarkup(n){const s=n.style||{};let content='';
    if(['heading','text','button'].includes(n.type))content+=`<div class="field full"><label>Text</label><textarea data-prop="text">${esc(n.text||'')}</textarea></div>`;
    if(n.type==='button')content+=`<div class="field"><label>Link</label><input data-prop="href" type="text" value="${attr(n.href||'#')}"></div>`;
    if(n.type==='image')content+=`<div class="field full"><label>Image URL / data URI</label><textarea data-prop="src">${esc(n.src||'')}</textarea></div><div class="field"><label>Alt text</label><input data-prop="alt" type="text" value="${attr(n.alt||'')}"></div>`;
    let layout=slider('Width','width',s.width,0,100,'%')+slider('Max width','maxWidth',s.maxWidth,0,1600,'px')+slider('Min height','minHeight',s.minHeight,0,1000,'px')+slider('Padding X','paddingX',s.paddingX,0,160,'px')+slider('Padding Y','paddingY',s.paddingY,0,160,'px')+slider('Top gap','marginTop',s.marginTop,0,200,'px')+slider('Bottom gap','marginBottom',s.marginBottom,0,200,'px')+slider('Gap','gap',s.gap,0,100,'px');
    if(n.type==='grid')layout+=slider('Columns','columns',s.columns,1,6,'',1);
    let appearance=color('Background','bg',s.bg)+slider('Radius','radius',s.radius,0,60,'px')+slider('Border','borderWidth',s.borderWidth,0,8,'px')+color('Border color','borderColor',s.borderColor)+slider('Shadow','shadow',s.shadow,0,60,'');
    if(['heading','text','button'].includes(n.type))appearance+=slider('Font size','fontSize',s.fontSize,9,100,'px')+slider('Weight','fontWeight',s.fontWeight,100,900,'',100)+slider('Line height','lineHeight',s.lineHeight,0.8,2.4,'',.05)+color('Text color','color',s.color)+`<div class="field"><label>Align</label><select data-style="align"><option ${s.align==='left'?'selected':''}>left</option><option ${s.align==='center'?'selected':''}>center</option><option ${s.align==='right'?'selected':''}>right</option></select></div>`;
    if(n.type==='image')appearance+=`<div class="field"><label>Fit</label><select data-style="objectFit"><option ${s.objectFit==='cover'?'selected':''}>cover</option><option ${s.objectFit==='contain'?'selected':''}>contain</option></select></div><div class="field"><label>Position</label><input data-style="objectPosition" type="text" value="${attr(s.objectPosition||'50% 50%')}"></div>`;
    const exact=`<div class="field full"><label>Exact CSS</label><textarea data-style="css">${esc(s.css||'')}</textarea></div><div class="field full"><label>Tablet CSS (≤ 900px)</label><textarea data-style="tabletCss">${esc(s.tabletCss||'')}</textarea></div><div class="field full"><label>Mobile CSS (≤ 600px)</label><textarea data-style="mobileCss">${esc(s.mobileCss||'')}</textarea></div>`;
    const actions=`<div class="node-actions"><button id="duplicateNode">Duplicate</button><button id="moveUp">Move up</button><button id="moveDown">Move down</button><button id="addInside" ${acceptsChildren(n)?'':'disabled'}>Add text inside</button></div>`;
    return group('Content',content||'<div style="color:#7f8794;font-size:11px">Container element</div>')+group('Size & layout',layout)+group('Appearance',appearance)+group('Exact & responsive',exact)+group('Node actions',actions)}
  function bindInspector(n){
    $$('[data-style]',inspector).forEach(input=>{const event=input.tagName==='TEXTAREA'||input.type==='text'?'change':'input';input.addEventListener(event,()=>{let v=input.value;if(input.type==='range')v=Number(v);n.style[input.dataset.style]=v;const out=inspector.querySelector(`[data-out="${input.dataset.style}"]`);if(out)out.textContent=v+(input.dataset.style==='width'?'%':(['columns','fontWeight','lineHeight','shadow'].includes(input.dataset.style)?'':'px'));render();save()})});
    $$('[data-prop]',inspector).forEach(input=>input.addEventListener('input',()=>{n[input.dataset.prop]=input.value;const el=canvas.querySelector(`[data-id="${n.id}"]`);if(el){if(n.type==='image'){el.src=n.src||'';el.alt=n.alt||''}else el.textContent=n.text||''}save()}));
    $('#duplicateNode')?.addEventListener('click',()=>{const f=findNode(n.id);commit(()=>{const c=JSON.parse(JSON.stringify(n));const reid=x=>{x.id=uid();(x.children||[]).forEach(reid)};reid(c);f.list.splice(f.index+1,0,c);selectedId=c.id})});
    $('#moveUp')?.addEventListener('click',()=>{const f=findNode(n.id);if(f.index<1)return;commit(()=>{const [x]=f.list.splice(f.index,1);f.list.splice(f.index-1,0,x)})});
    $('#moveDown')?.addEventListener('click',()=>{const f=findNode(n.id);if(f.index>=f.list.length-1)return;commit(()=>{const [x]=f.list.splice(f.index,1);f.list.splice(f.index+1,0,x)})});
    $('#addInside')?.addEventListener('click',()=>{if(!acceptsChildren(n))return;commit(()=>{const c=make('text');n.children.push(c);selectedId=c.id})})
  }
  function inlineEdit(el,n){el.contentEditable='true';el.focus();const done=()=>{el.contentEditable='false';n.text=el.textContent;save();el.removeEventListener('blur',done)};el.addEventListener('blur',done)}
  function setDevice(d,shouldSave=true){project.device=d;pageFrame.className='page-frame '+d;$$('.device-btn').forEach(b=>b.classList.toggle('active',b.dataset.device===d));$('#deviceLabel').textContent=d==='desktop'?'Desktop · 1200 px':d==='tablet'?'Tablet · 768 px':'Mobile · 390 px';if(shouldSave)save()}
  function addElement(type){commit(()=>{const n=make(type);const f=findNode(selectedId);if(f&&acceptsChildren(f.node))f.node.children.push(n);else if(f&&f.parent&&acceptsChildren(f.parent))f.list.splice(f.index+1,0,n);else project.elements.push(n);selectedId=n.id});toast(type+' added')}
  $$('.element-card').forEach(b=>b.addEventListener('click',()=>addElement(b.dataset.type)));canvas.addEventListener('click',()=>{selectedId=null;renderSelection();$$('.sf-node',canvas).forEach(x=>x.classList.remove('selected'))});
  deleteBtn.addEventListener('click',()=>{const f=findNode(selectedId);if(!f)return;commit(()=>{f.list.splice(f.index,1);selectedId=null})});
  $('#projectTitle').addEventListener('input',e=>{project.title=e.target.value;save()});$$('.device-btn').forEach(b=>b.addEventListener('click',()=>setDevice(b.dataset.device)));
  $('#undoBtn').addEventListener('click',()=>{if(!undoStack.length)return;redoStack.push(JSON.stringify(project));project=JSON.parse(undoStack.pop());selectedId=null;render();save()});$('#redoBtn').addEventListener('click',()=>{if(!redoStack.length)return;undoStack.push(JSON.stringify(project));project=JSON.parse(redoStack.pop());selectedId=null;render();save()});
  $('#newProjectBtn').addEventListener('click',()=>{if(!confirm('Start a new project?'))return;project=starterProject();selectedId=null;render();save()});
  $('#saveProjectBtn').addEventListener('click',()=>download(`${slug(project.title)||'siteforge-project'}.siteforge.json`,JSON.stringify(project,null,2),'application/json'));
  $('#openProjectInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{project=normalizeProject(JSON.parse(await f.text()));selectedId=null;render();save();toast('Project opened')}catch(err){alert('That file is not a valid SiteForge project.')}e.target.value='' });
  $('#referenceInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const img=$('#referenceOverlay');img.src=URL.createObjectURL(f);$('#referenceToggle').checked=true;img.classList.remove('hidden')});$('#referenceToggle').addEventListener('change',e=>$('#referenceOverlay').classList.toggle('hidden',!e.target.checked));$('#referenceOpacity').addEventListener('input',e=>$('#referenceOverlay').style.opacity=Number(e.target.value)/100);
  $('#previewBtn').addEventListener('click',()=>{$('#previewFrame').srcdoc=exportHtml();$('#previewOverlay').classList.remove('hidden')});$('#closePreviewBtn').addEventListener('click',()=>$('#previewOverlay').classList.add('hidden'));$('#exportBtn').addEventListener('click',()=>download(`${slug(project.title)||'website'}.html`,exportHtml(),'text/html'));

  function exportNode(n){const st=attr(styleString(n)), id=attr(n.id);if(n.type==='section')return `<section data-sf-id="${id}" style="${st}">${(n.children||[]).map(exportNode).join('')}</section>`;if(['container','grid','card'].includes(n.type))return `<div data-sf-id="${id}" style="${st}">${(n.children||[]).map(exportNode).join('')}</div>`;if(n.type==='heading')return `<${n.tag||'h2'} data-sf-id="${id}" style="${st}">${esc(n.text||'')}</${n.tag||'h2'}>`;if(n.type==='text')return `<${n.tag||'p'} data-sf-id="${id}" style="${st}">${esc(n.text||'')}</${n.tag||'p'}>`;if(n.type==='button')return `<a data-sf-id="${id}" href="${attr(n.href||'#')}" style="${st}">${esc(n.text||'')}</a>`;if(n.type==='image')return `<img data-sf-id="${id}" src="${attr(n.src||'')}" alt="${attr(n.alt||'')}" style="${st}">`;return `<div data-sf-id="${id}" style="${st}"></div>`}
  function responsiveCss(){let tablet='',mobile='';walk(project.elements,null,n=>{if(n.style?.tabletCss)tablet+=`[data-sf-id="${n.id}"]{${n.style.tabletCss}}\n`;if(n.style?.mobileCss)mobile+=`[data-sf-id="${n.id}"]{${n.style.mobileCss}}\n`});return `${tablet?`@media(max-width:900px){${tablet}}`:''}${mobile?`@media(max-width:600px){${mobile}}`:''}`}
  function exportHtml(){const body=project.elements.map(exportNode).join('\n');return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)}</title><style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${project.page?.bg||'#fff'};color:#17120e;font-family:Georgia,serif}img{max-width:100%}h1,h2,h3,h4,p{margin:0}a{color:inherit}${project.globalCss||''}${responsiveCss()}</style></head><body><main style="max-width:${project.page?.maxWidth||1440}px;margin:0 auto;${project.page?.css||''}">${body}</main></body></html>`}
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},300)}function slug(s=''){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1400)}
  render();save();
})();
