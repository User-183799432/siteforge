(() => {
  const STORAGE_KEY = 'siteforge-v1-project';
  const uid = () => 'sf-' + Math.random().toString(36).slice(2, 9);
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const canvas = $('#canvas');
  const inspector = $('#inspector');
  const selectionLabel = $('#selectionLabel');
  const deleteBtn = $('#deleteBtn');
  const pageFrame = $('#pageFrame');
  const saveState = $('#saveState');
  const projectTitle = $('#projectTitle');
  let selectedId = null;
  let undoStack = [];
  let redoStack = [];
  let project = load() || starterProject();

  function starterProject(){
    return {
      version:1,title:'My First Site',device:'desktop',
      elements:[
        make('heading',{text:'Build something worth keeping.'}),
        make('text',{text:'SiteForge gives you a visual way to design a website, then fine-tune every detail yourself.'}),
        make('button',{text:'Start editing'})
      ]
    };
  }

  function make(type, overrides={}){
    const base={id:uid(),type,text:'',style:{width:100,height:0,fontSize:16,fontWeight:400,align:'left',marginTop:0,marginBottom:0,padding:0,bg:'#ffffff',color:'#171a20',radius:0}};
    const presets={
      section:{style:{...base.style,height:140,padding:24,bg:'#ffffff',radius:14}},
      heading:{text:'Your headline',style:{...base.style,fontSize:42,fontWeight:800}},
      text:{text:'Add your body text here. Double-click to edit it directly.',style:{...base.style,fontSize:16}},
      button:{text:'Button',style:{...base.style,width:0,fontSize:15,fontWeight:700,padding:12,bg:'#111827',color:'#ffffff',radius:10}},
      image:{src:'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80',alt:'Website image',style:{...base.style,height:300,radius:12}},
      spacer:{style:{...base.style,height:48}},
      divider:{style:{...base.style,height:1,bg:'#cdd2db'}},
      columns:{style:{...base.style,height:120}}
    };
    const p=presets[type]||{};
    return {...base,...p,...overrides,style:{...base.style,...(p.style||{}),...(overrides.style||{})}};
  }

  function save(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(project));
    saveState.textContent='Saved locally';
  }
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))}catch{return null}}
  function snapshot(){
    undoStack.push(JSON.stringify(project)); if(undoStack.length>80) undoStack.shift(); redoStack=[]; updateUndoButtons();
  }
  function updateUndoButtons(){ $('#undoBtn').disabled=!undoStack.length; $('#redoBtn').disabled=!redoStack.length; }
  function restore(json){ project=JSON.parse(json); selectedId=null; projectTitle.value=project.title||'Untitled Site'; render(); save(); }
  function commit(mutator){ snapshot(); mutator(); saveState.textContent='Saving…'; render(); save(); }

  function nodeStyle(el){
    const s=el.style||{}; const css={};
    if(s.width>0) css.width=s.width+'%';
    if(s.height>0) css.height=s.height+'px';
    if(['heading','text','button'].includes(el.type)){css.fontSize=s.fontSize+'px';css.fontWeight=s.fontWeight;css.textAlign=s.align;css.color=s.color}
    if(['section','button','divider'].includes(el.type)) css.background=s.bg;
    if(['section','button','image'].includes(el.type)) css.borderRadius=s.radius+'px';
    if(['section','button'].includes(el.type)) css.padding=s.padding+'px';
    css.marginTop=s.marginTop+'px';css.marginBottom=s.marginBottom+'px';
    return Object.entries(css).map(([k,v])=>`${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}:${v}`).join(';');
  }

  function createNode(el){
    let n;
    if(el.type==='heading'){n=document.createElement('h1');n.className='sf-heading';n.textContent=el.text}
    else if(el.type==='text'){n=document.createElement('p');n.className='sf-text';n.textContent=el.text}
    else if(el.type==='button'){n=document.createElement('div');n.className='sf-button';n.textContent=el.text}
    else if(el.type==='image'){n=document.createElement('img');n.className='sf-image';n.src=el.src||'';n.alt=el.alt||''}
    else if(el.type==='spacer'){n=document.createElement('div');n.className='sf-spacer'}
    else if(el.type==='divider'){n=document.createElement('div');n.className='sf-divider'}
    else if(el.type==='columns'){n=document.createElement('div');n.className='sf-columns';n.innerHTML='<div class="sf-col">Column 1</div><div class="sf-col">Column 2</div>'}
    else {n=document.createElement('div');n.className='sf-section';n.innerHTML='<strong>Section</strong><div style="margin-top:6px;color:#777">Drop-in container styling. Nested content arrives in V2.</div>'}
    n.classList.add('sf-node'); n.dataset.id=el.id; n.draggable=true; n.style.cssText += ';'+nodeStyle(el);
    if(el.id===selectedId)n.classList.add('selected');
    n.addEventListener('click',e=>{e.stopPropagation();selectedId=el.id;renderSelection()});
    if(['heading','text','button'].includes(el.type)) n.addEventListener('dblclick',()=>inlineEdit(n,el));
    n.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-siteforge-existing',el.id);n.classList.add('dragging')});
    n.addEventListener('dragend',()=>n.classList.remove('dragging'));
    return n;
  }

  function render(){
    canvas.innerHTML=''; canvas.classList.toggle('empty',project.elements.length===0);
    project.elements.forEach(el=>canvas.appendChild(createNode(el)));
    projectTitle.value=project.title||'Untitled Site'; setDevice(project.device||'desktop',false); renderSelection(); updateUndoButtons();
  }
  function renderSelection(){
    $$('.sf-node').forEach(n=>n.classList.toggle('selected',n.dataset.id===selectedId));
    const el=project.elements.find(x=>x.id===selectedId);
    deleteBtn.disabled=!el;
    if(!el){selectionLabel.textContent='Nothing selected';inspector.className='inspector-empty';inspector.innerHTML='<div class="empty-graphic">◇</div><h3>Select an element</h3><p>Click something on the page to adjust size, spacing, alignment, color, and more.</p>';return}
    selectionLabel.textContent=el.type[0].toUpperCase()+el.type.slice(1);
    inspector.className='inspector-body'; inspector.innerHTML=inspectorMarkup(el); bindInspector(el);
  }

  function inspectorMarkup(el){
    const s=el.style; const textField=['heading','text','button'].includes(el.type)?`<div class="field"><label>Text</label><textarea data-prop="text">${esc(el.text)}</textarea></div>`:'';
    const imageFields=el.type==='image'?`<div class="field"><label>Image URL</label><textarea data-prop="src">${esc(el.src||'')}</textarea></div><div class="field"><label>Alt text</label><input data-prop="alt" type="text" value="${attr(el.alt||'')}" /></div>`:'';
    const typo=['heading','text','button'].includes(el.type)?group('Typography',slider('Font size','fontSize',s.fontSize,10,100,'px')+slider('Weight','fontWeight',s.fontWeight,100,900,'')+alignControl(s.align)+color('Text color','color',s.color)):'';
    const bg=['section','button','divider'].includes(el.type)?color('Background','bg',s.bg):'';
    const radius=['section','button','image'].includes(el.type)?slider('Radius','radius',s.radius,0,60,'px'):'';
    const pad=['section','button'].includes(el.type)?slider('Padding','padding',s.padding,0,80,'px'):'';
    const height=['section','image','spacer','columns'].includes(el.type)?slider('Height','height',s.height,1,700,'px'):'';
    return `${group('Content',textField+imageFields)}${group('Size & spacing',slider('Width','width',s.width,20,100,'%')+height+slider('Top gap','marginTop',s.marginTop,0,160,'px')+slider('Bottom gap','marginBottom',s.marginBottom,0,160,'px')+pad+radius)}${typo}${bg?group('Appearance',bg):''}`;
  }
  function group(title,body){return body?`<section class="inspector-group"><h3>${title}</h3>${body}</section>`:''}
  function slider(label,key,val,min,max,suffix){return `<div class="field"><label>${label}</label><div class="slider-row"><input type="range" min="${min}" max="${max}" value="${val}" data-style="${key}"><output data-out="${key}">${val}${suffix}</output></div></div>`}
  function color(label,key,val){return `<div class="field"><label>${label}</label><input class="color-input" type="color" value="${val}" data-style="${key}"></div>`}
  function alignControl(value){return `<div class="field"><label>Align</label><div class="segmented">${['left','center','right'].map(a=>`<button data-align="${a}" class="${a===value?'active':''}">${a[0].toUpperCase()}</button>`).join('')}</div></div>`}
  function esc(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function attr(s=''){return esc(s).replace(/"/g,'&quot;')}

  function bindInspector(el){
    $$('[data-style]',inspector).forEach(input=>input.addEventListener('input',()=>{
      const k=input.dataset.style; const value=input.type==='color'?input.value:Number(input.value); el.style[k]=value; const out=inspector.querySelector(`[data-out="${k}"]`); if(out) out.textContent=value+(k==='width'?'%':(['fontWeight'].includes(k)?'':'px')); applyNodeLive(el); save();
    }));
    $$('[data-prop]',inspector).forEach(input=>input.addEventListener('input',()=>{el[input.dataset.prop]=input.value;applyNodeLive(el);save()}));
    $$('[data-align]',inspector).forEach(btn=>btn.addEventListener('click',()=>{el.style.align=btn.dataset.align;renderSelection();applyNodeLive(el);save()}));
  }
  function applyNodeLive(el){
    const n=canvas.querySelector(`[data-id="${el.id}"]`); if(!n)return; n.style.cssText=';'+nodeStyle(el);
    if(['heading','text','button'].includes(el.type)) n.textContent=el.text;
    if(el.type==='image'){n.src=el.src||'';n.alt=el.alt||''}
  }
  function inlineEdit(node,el){
    node.contentEditable='true';node.focus();document.execCommand?.('selectAll',false,null);
    const finish=()=>{node.contentEditable='false';el.text=node.textContent.trim()||el.text;save();renderSelection();node.removeEventListener('blur',finish)};
    node.addEventListener('blur',finish);node.addEventListener('keydown',e=>{if(e.key==='Escape')node.blur();if(e.key==='Enter'&&el.type!=='text'){e.preventDefault();node.blur()}})
  }

  function setDevice(device,shouldSave=true){
    project.device=device; pageFrame.className='page-frame '+device; $$('.device-btn').forEach(b=>b.classList.toggle('active',b.dataset.device===device));
    $('#deviceLabel').textContent= device==='desktop'?'Desktop · 1200 px':device==='tablet'?'Tablet · 768 px':'Mobile · 390 px'; if(shouldSave)save();
  }

  function addElement(type,index=project.elements.length){ commit(()=>{const el=make(type);project.elements.splice(index,0,el);selectedId=el.id}); toast(type[0].toUpperCase()+type.slice(1)+' added'); }
  function insertionIndex(y){ const nodes=$$('.sf-node',canvas); for(let i=0;i<nodes.length;i++){const r=nodes[i].getBoundingClientRect();if(y<r.top+r.height/2)return i}return nodes.length }
  canvas.addEventListener('dragover',e=>{e.preventDefault()});
  canvas.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/x-siteforge-new');const existing=e.dataTransfer.getData('text/x-siteforge-existing');const idx=insertionIndex(e.clientY);if(type)addElement(type,idx);else if(existing){const from=project.elements.findIndex(x=>x.id===existing);if(from<0)return;commit(()=>{const [m]=project.elements.splice(from,1);let to=idx;if(from<idx)to--;project.elements.splice(Math.max(0,to),0,m);selectedId=m.id})}});
  canvas.addEventListener('click',()=>{selectedId=null;renderSelection()});
  $$('.element-card').forEach(card=>{card.addEventListener('dragstart',e=>e.dataTransfer.setData('text/x-siteforge-new',card.dataset.type));card.addEventListener('click',()=>addElement(card.dataset.type))});

  deleteBtn.addEventListener('click',()=>{if(!selectedId)return;commit(()=>{project.elements=project.elements.filter(x=>x.id!==selectedId);selectedId=null});toast('Element deleted')});
  projectTitle.addEventListener('input',()=>{project.title=projectTitle.value;save()});
  $$('.device-btn').forEach(btn=>btn.addEventListener('click',()=>setDevice(btn.dataset.device)));
  $('#sidebarToggle').addEventListener('click',()=>$('#elementsPanel').classList.toggle('collapsed'));
  $('#undoBtn').addEventListener('click',()=>{if(!undoStack.length)return;redoStack.push(JSON.stringify(project));restore(undoStack.pop())});
  $('#redoBtn').addEventListener('click',()=>{if(!redoStack.length)return;undoStack.push(JSON.stringify(project));restore(redoStack.pop())});
  $('#newProjectBtn').addEventListener('click',()=>{if(!confirm('Start a new project? Your current project is saved locally, but this will replace it.'))return;snapshot();project={version:1,title:'Untitled Site',device:'desktop',elements:[]};selectedId=null;render();save();toast('New project ready')});
  $('#saveProjectBtn').addEventListener('click',()=>download(`${slug(project.title)||'siteforge-project'}.siteforge.json`,JSON.stringify(project,null,2),'application/json'));
  $('#openProjectInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.elements))throw 0;snapshot();project=data;selectedId=null;render();save();toast('Project opened')}catch{alert('That file is not a valid SiteForge project.')}e.target.value='' });
  $('#previewBtn').addEventListener('click',()=>{const html=exportHtml();$('#previewFrame').srcdoc=html;$('#previewOverlay').classList.remove('hidden')});
  $('#closePreviewBtn').addEventListener('click',()=>$('#previewOverlay').classList.add('hidden'));
  $('#exportBtn').addEventListener('click',()=>download(`${slug(project.title)||'website'}.html`,exportHtml(),'text/html'));

  function exportElement(el){
    const style=nodeStyle(el); const common=`style="${attr(style)}"`;
    if(el.type==='heading')return `<h1 ${common}>${esc(el.text)}</h1>`;
    if(el.type==='text')return `<p ${common}>${esc(el.text)}</p>`;
    if(el.type==='button')return `<a href="#" ${common}>${esc(el.text)}</a>`;
    if(el.type==='image')return `<img src="${attr(el.src||'')}" alt="${attr(el.alt||'')}" ${common}>`;
    if(el.type==='spacer')return `<div aria-hidden="true" style="height:${el.style.height}px;margin-top:${el.style.marginTop}px;margin-bottom:${el.style.marginBottom}px"></div>`;
    if(el.type==='divider')return `<div aria-hidden="true" ${common}></div>`;
    if(el.type==='columns')return `<div class="cols" ${common}><div>Column 1</div><div>Column 2</div></div>`;
    return `<section ${common}><strong>Section</strong></section>`;
  }
  function exportHtml(){
    const body=project.elements.map(exportElement).join('\n');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#171a20;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.page{max-width:1200px;margin:auto;min-height:100vh;padding:28px;display:flex;flex-direction:column;gap:12px}h1,p{margin-left:0;margin-right:0}a{display:inline-flex;text-decoration:none;align-items:center;justify-content:center}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cols>div{min-height:100px;border:1px dashed #ccd1d9;display:grid;place-items:center;background:white;border-radius:10px}@media(max-width:600px){.page{padding:18px}.cols{grid-template-columns:1fr}h1{font-size:min(12vw,48px)!important}}</style></head><body><main class="page">${body}</main></body></html>`;
  }
  function slug(s=''){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},250)}
  function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1600)}

  render(); save();
})();
