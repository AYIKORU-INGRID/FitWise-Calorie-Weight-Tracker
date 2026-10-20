(function(){
var KEY='daily-tracker-v1';
var S={goal:2000,goalWt:null,foods:{},weights:[]};
try{var raw=localStorage.getItem(KEY);if(raw){var p=JSON.parse(raw);if(p&&typeof p==='object')S=Object.assign(S,p)}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function $(id){return document.getElementById(id)}
function iso(d){return d.toLocaleDateString('en-CA')}
var day=iso(new Date());
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nice(s){var d=new Date(s+'T12:00:00');return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
var QUICK=[['Rolex',550],['Chapati',250],['Posho (1 plate)',350],['Matooke (1 plate)',300],['Beans (1 cup)',230],['Rice (1 cup)',205],['Mandazi',150],['Banana',105],['Tea with sugar',50],['Milk (1 cup)',120], ['Bread(2 slices)',160], ['Egg (1 large)',70]];
$('chips').innerHTML=QUICK.map(function(q,i){return '<button class="chip" data-i="'+i+'">'+q[0]+' · '+q[1]+'</button>'}).join('');
var mealByHour=function(){var h=new Date().getHours();return h<11?'Breakfast':h<16?'Lunch':h<21?'Dinner':'Snack'};

function tab(w){var f=w==='food';$('p-food').hidden=!f;$('p-wt').hidden=f;$('t-food').setAttribute('aria-selected',f);$('t-wt').setAttribute('aria-selected',!f)}
$('t-food').onclick=function(){tab('food')};$('t-wt').onclick=function(){tab('wt')};

function shift(n){var d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);day=iso(d);renderFood()}
$('prev').onclick=function(){shift(-1)};$('next').onclick=function(){shift(1)};

function renderFood(){
  var items=S.foods[day]||[];
  var total=items.reduce(function(a,b){return a+b.kcal},0);
  var left=S.goal-total;
  $('dlabel').textContent=day===iso(new Date())?'Today, '+nice(day):nice(day);
  $('eaten').textContent=total;$('goal').textContent=S.goal;
  $('remain').textContent=Math.abs(left);
  $('remainlbl').textContent=left>=0?'kcal left':'kcal over';
  var r=$('ring');r.style.stroke=left<0?'var(--warn)':'var(--pri)';
  r.setAttribute('stroke-dashoffset',439.8*(1-Math.min(total/S.goal,1)));
  $('flist').innerHTML=items.length?items.map(function(it){return '<li><div class="nm">'+esc(it.name)+'<small>'+esc(it.meal)+'</small></div><b>'+it.kcal+'</b><button class="x" data-id="'+it.id+'" aria-label="Delete '+esc(it.name)+'">✕</button></li>'}).join(''):'<li class="empty">Nothing logged yet. Add your first meal above.</li>';
}
function addFood(name,kcal,meal){
  kcal=Math.round(Number(kcal));
  if(!name||!isFinite(kcal)||kcal<0)return;
  (S.foods[day]=S.foods[day]||[]).push({id:Date.now()+Math.random(),name:name,kcal:kcal,meal:meal});
  save();renderFood();
}
$('addfood').onclick=function(){
  addFood($('fname').value.trim(),$('fkcal').value,$('fmeal').value);
  $('fname').value='';$('fkcal').value='';$('fname').focus();
};
$('chips').onclick=function(e){var b=e.target.closest('.chip');if(!b)return;var q=QUICK[b.dataset.i];addFood(q[0],q[1],mealByHour())};
$('flist').onclick=function(e){var b=e.target.closest('.x');if(!b)return;S.foods[day]=(S.foods[day]||[]).filter(function(x){return String(x.id)!==b.dataset.id});save();renderFood()};

function sorted(){return S.weights.slice().sort(function(a,b){return a.date<b.date?-1:1})}
function renderWeight(){
  var w=sorted();
  var last=w[w.length-1],first=w[0];
  $('wlatest').textContent=last?last.kg.toFixed(1):'–';
  $('wchange').textContent=(last&&first&&w.length>1)?((last.kg-first.kg>0?'+':'')+(last.kg-first.kg).toFixed(1)):'–';
  $('wtogoal').textContent=(last&&S.goalWt)?Math.abs(last.kg-S.goalWt).toFixed(1):'–';
  $('sgoal').value=S.goal;$('swt').value=S.goalWt||'';
  var c=$('chart');
  if(w.length<2){c.innerHTML='<div class="empty">Log at least two weights to see your trend.</div>'}
  else{
    var W=320,H=170,pl=34,pr=10,pt=12,pb=24;
    var vals=w.map(function(x){return x.kg});if(S.goalWt)vals.push(S.goalWt);
    var lo=Math.floor(Math.min.apply(null,vals)-1),hi=Math.ceil(Math.max.apply(null,vals)+1);
    var t0=new Date(w[0].date).getTime(),t1=new Date(w[w.length-1].date).getTime();
    function X(d){return pl+(t1===t0?0:(new Date(d).getTime()-t0)/(t1-t0))*(W-pl-pr)}
    function Y(v){return pt+(hi-v)/(hi-lo)*(H-pt-pb)}
    var pts=w.map(function(x){return X(x.date).toFixed(1)+','+Y(x.kg).toFixed(1)}).join(' ');
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Weight over time">';
    [lo,(lo+hi)/2,hi].forEach(function(v){s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)"/><text x="'+(pl-4)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="10" fill="var(--mute)">'+(Math.round(v*10)/10)+'</text>'});
    if(S.goalWt)s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(S.goalWt)+'" y2="'+Y(S.goalWt)+'" stroke="var(--warn)" stroke-dasharray="4 4"/>';
    s+='<polyline points="'+pts+'" fill="none" stroke="var(--pri)" stroke-width="2.5" stroke-linejoin="round"/>';
    w.forEach(function(x){s+='<circle cx="'+X(x.date)+'" cy="'+Y(x.kg)+'" r="3.5" fill="var(--pri)"/>'});
    s+='<text x="'+pl+'" y="'+(H-6)+'" font-size="10" fill="var(--mute)">'+nice(w[0].date)+'</text><text x="'+(W-pr)+'" y="'+(H-6)+'" text-anchor="end" font-size="10" fill="var(--mute)">'+nice(w[w.length-1].date)+'</text></svg>';
    c.innerHTML=s;
  }
  $('wlist').innerHTML=w.length?w.slice().reverse().map(function(x){return '<li><div class="nm">'+nice(x.date)+'</div><b>'+x.kg.toFixed(1)+' kg</b><button class="x" data-d="'+x.date+'" aria-label="Delete entry">✕</button></li>'}).join(''):'<li class="empty">No weights yet. Save your first one above.</li>';
}
$('wdate').value=iso(new Date());
$('addwt').onclick=function(){
  var kg=parseFloat($('wkg').value),d=$('wdate').value;
  if(!isFinite(kg)||kg<20||kg>400||!d)return;
  S.weights=S.weights.filter(function(x){return x.date!==d});
  S.weights.push({date:d,kg:Math.round(kg*10)/10});
  $('wkg').value='';save();renderWeight();
};
$('wlist').onclick=function(e){var b=e.target.closest('.x');if(!b)return;S.weights=S.weights.filter(function(x){return x.date!==b.dataset.d});save();renderWeight()};
$('savegoals').onclick=function(){
  var g=parseInt($('sgoal').value,10),t=parseFloat($('swt').value);
  if(isFinite(g)&&g>=800&&g<=6000)S.goal=g;
  S.goalWt=isFinite(t)&&t>=20&&t<=400?t:null;
  save();renderWeight();renderFood();
};
renderFood();renderWeight();
})();
