(function(){
var KEY='daily-tracker-v1';
function defaultState(){return {goal:2000,goalWt:null,foods:{},weights:[],water:{},setupComplete:false}}
function normalizeState(value){
  var state=defaultState();
  if(!value||typeof value!=='object'||Array.isArray(value))return state;
  if(Number.isInteger(value.goal)&&value.goal>=800&&value.goal<=6000)state.goal=value.goal;
  if(value.goalWt===null||(typeof value.goalWt==='number'&&Number.isFinite(value.goalWt)&&value.goalWt>=20&&value.goalWt<=400))state.goalWt=value.goalWt;
  if(value.foods&&typeof value.foods==='object'&&!Array.isArray(value.foods)){
    Object.keys(value.foods).forEach(function(date){
      var items=value.foods[date];
      if(!Array.isArray(items))return;
      state.foods[date]=items.filter(function(item){
        return item&&typeof item.name==='string'&&item.name.length<=60&&Number.isInteger(item.kcal)&&item.kcal>=1&&item.kcal<=5000&&['Breakfast','Lunch','Dinner','Snack'].indexOf(item.meal)!==-1;
      }).map(function(item){return {id:item.id||Date.now()+Math.random(),name:item.name,kcal:item.kcal,meal:item.meal}});
    });
  }
  if(Array.isArray(value.weights)){
    state.weights=value.weights.filter(function(item){
      return item&&typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&typeof item.kg==='number'&&Number.isFinite(item.kg)&&item.kg>=20&&item.kg<=400;
    }).map(function(item){return {date:item.date,kg:item.kg}});
  }
  if(value.water&&typeof value.water==='object'&&!Array.isArray(value.water)){
    Object.keys(value.water).forEach(function(date){
      var count=value.water[date];
      if(Number.isInteger(count)&&count>=0&&count<=40)state.water[date]=count;
    });
  }
  state.setupComplete=value.setupComplete===true;
  return state;
}
var S=defaultState();
var supabaseClient=null;
var currentUser=null;
var loadedUserId=null;
var loadingUserId=null;
var accountGeneration=0;
var pendingSave=Promise.resolve(true);
var importLegacyOnFirstLogin=false;
function $(id){return document.getElementById(id)}
function message(id,text,isError){
  var el=$(id);
  el.textContent=text;
  if(text)el.setAttribute('data-error',String(isError));
  else el.removeAttribute('data-error');
}
function fieldError(input,text){
  input.setAttribute('aria-invalid',String(Boolean(text)));
  if(text)input.setAttribute('title',text);
  else input.removeAttribute('title');
}
async function save(){
  if(!supabaseClient||!currentUser)return false;
  var userId=currentUser.id;
  var snapshot=JSON.parse(JSON.stringify(S));
  function writeSnapshot(){
    if(!currentUser||currentUser.id!==userId)return true;
    return supabaseClient.from('tracker_data').upsert({
      user_id:userId,
      data:snapshot,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'}).then(function(result){
      if(result.error)throw result.error;
      if(currentUser&&currentUser.id===userId)message('sync-status','Saved to your account.',false);
      return true;
    });
  }
  message('sync-status','Saving to your account…',false);
  pendingSave=pendingSave.catch(function(){return false}).then(writeSnapshot).catch(function(error){
    console.error('Unable to save tracker data to Supabase:',error);
    if(currentUser&&currentUser.id===userId)message('sync-status','Could not save to your account. Check your connection and Supabase setup, then try again.',true);
    return false;
  });
  return pendingSave;
}
function iso(d){return d.toLocaleDateString('en-CA')}
var day=iso(new Date());
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nice(s){var d=new Date(s+'T12:00:00');return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
var QUICK=[['Rolex',550],['Chapati',250],['Posho (1 plate)',350],['Matooke (1 plate)',300],['Beans (1 cup)',230],['Rice (1 cup)',205],['Mandazi',150],['Banana',105],['Tea with sugar',50],['Milk (1 cup)',120], ['Bread(2 slices)',160], ['Egg (1 large)',70]];
$('chips').innerHTML=QUICK.map(function(q,i){return '<button class="chip" data-i="'+i+'">'+q[0]+' · '+q[1]+'</button>'}).join('');
var mealByHour=function(){var h=new Date().getHours();return h<11?'Breakfast':h<16?'Lunch':h<21?'Dinner':'Snack'};

var selectedGoal='lose';
var caloriesEdited=false;
function estimateCalories(){
  var age=Number($('oage').value),height=Number($('oht').value),weight=Number($('owt').value);
  if(!age||!height||!weight)return null;
  var bmr=10*weight+6.25*height-5*age+($('osex').value==='m'?5:-161);
  var target=bmr*Number($('oactivity').value)-(selectedGoal==='lose'?500:0);
  return Math.max(1000,Math.min(6000,Math.round(target/50)*50));
}
function updateSuggestion(){
  var estimate=estimateCalories();
  if(estimate===null){$('osug').textContent='';return}
  $('osug').textContent='Suggested starting target: '+estimate+' kcal/day. This is a rough estimate; adjust it to suit your needs.';
  if(!caloriesEdited)$('okcal').value=estimate;
}
['oage','osex','oht','owt','oactivity'].forEach(function(id){
  $(id).addEventListener('input',updateSuggestion);
  $(id).addEventListener('change',updateSuggestion);
});
$('okcal').addEventListener('input',function(){caloriesEdited=true});
$('onboard-form').addEventListener('invalid',function(e){
  var input=e.target;
  var reason=input.validity.valueMissing?'Please fill in this field.':
    input.validity.rangeUnderflow?'Enter a value of at least '+input.min+'.':
    input.validity.rangeOverflow?'Enter a value no greater than '+input.max+'.':
    input.validity.stepMismatch?'Enter a value in the allowed increments.':
    'Enter a valid number.';
  $('oerr').textContent=reason;
},true);
Array.prototype.forEach.call($('onboard-form').querySelectorAll('input,select'),function(input){
  input.setAttribute('aria-describedby','oerr');
  input.addEventListener('input',function(){$('oerr').textContent=''});
  input.addEventListener('change',function(){$('oerr').textContent=''});
});
$('seg').onclick=function(e){
  var b=e.target.closest('button[data-g]');
  if(!b)return;
  selectedGoal=b.dataset.g;
  Array.prototype.forEach.call($('seg').querySelectorAll('button'),function(button){
    button.setAttribute('aria-pressed',button===b);
  });
  updateSuggestion();
};
$('onboard-form').onsubmit=async function(e){
  e.preventDefault();
  $('oerr').textContent='';
  var estimate=estimateCalories();
  var goalInput=$('okcal').value;
  var calories=goalInput===''?estimate:Number(goalInput);
  var goalWeight=$('ogw').value===''?null:Number($('ogw').value);
  if(estimate===null||!isFinite(calories)||calories<1000||calories>6000||
     (goalWeight!==null&&(!isFinite(goalWeight)||goalWeight<20||goalWeight>400))){
    $('oerr').textContent='Check your details and enter values within the stated ranges.';
    return;
  }
  S.weights=Array.isArray(S.weights)?S.weights:[];
  var today=iso(new Date());
  var previousSetup={goal:S.goal,goalWt:S.goalWt,weights:S.weights,setupComplete:S.setupComplete};
  S.goal=calories;
  S.goalWt=goalWeight;
  var hadToday=S.weights.some(function(item){return item.date===today});
  if(!hadToday)S.weights=S.weights.concat([{date:today,kg:Math.round(Number($('owt').value)*10)/10}]);
  S.setupComplete=true;
  if(!await save()){
    S.goal=previousSetup.goal;
    S.goalWt=previousSetup.goalWt;
    S.weights=previousSetup.weights;
    S.setupComplete=previousSetup.setupComplete;
    $('oerr').textContent='Could not save your setup to your account. Check your connection and try again.';
    return;
  }
  $('onb').hidden=true;
  $('tabs').hidden=false;
  $('p-food').hidden=false;
  $('p-wt').hidden=true;
  $('wdate').value=today;
  renderFood();
  renderWeight();
};

function tab(w){
  ['food','wt','coach'].forEach(function(name){
    var selected=name===w;
    $('p-'+name).hidden=!selected;
    $('t-'+name).setAttribute('aria-selected',selected);
  });
}
$('t-food').onclick=function(){tab('food')};
$('t-wt').onclick=function(){tab('wt')};
$('t-coach').onclick=function(){tab('coach')};

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
  renderWater();
}
var WATER_GOAL=8;
var WATER_MAX=40;
function waterCount(date){
  var count=S.water[date];
  return Number.isInteger(count)&&count>=0&&count<=WATER_MAX?count:0;
}
function glassLabel(count){return count+' '+(count===1?'glass':'glasses')}
function renderWater(){
  var count=waterCount(day);
  $('wcount').textContent=count;
  $('wgoal').textContent='of '+WATER_GOAL+' glasses · '+(count*250)+' ml';
  $('wminus').disabled=count===0;
  $('wplus').disabled=count>=WATER_MAX||day>iso(new Date());
  $('cups').textContent='';
  $('cups').setAttribute('aria-label',count+' glasses logged for '+nice(day));
  for(var i=0;i<WATER_GOAL;i++){
    var cup=document.createElement('span');
    cup.className='cup'+(i<count?' filled':'');
    cup.setAttribute('aria-hidden','true');
    $('cups').appendChild(cup);
  }
  var bars=$('week');
  bars.textContent='';
  bars.setAttribute('aria-label','Water logged over the seven days ending '+nice(day));
  var dates=[];
  for(var offset=6;offset>=0;offset--){
    var date=new Date(day+'T12:00:00');
    date.setDate(date.getDate()-offset);
    dates.push(iso(date));
  }
  var counts=dates.map(waterCount);
  var maxCount=Math.max.apply(null,[WATER_GOAL].concat(counts));
  dates.forEach(function(date,index){
    var entry=document.createElement('div');
    entry.className='week-day';
    var bar=document.createElement('div');
    bar.className='week-bar';
    bar.style.height=(counts[index]/maxCount*100)+'%';
    bar.setAttribute('aria-label',glassLabel(counts[index]));
    var label=document.createElement('span');
    label.className='week-label';
    label.textContent=new Date(date+'T12:00:00').toLocaleDateString('en',{weekday:'short'});
    entry.appendChild(bar);
    entry.appendChild(label);
    bars.appendChild(entry);
  });
  $('wk').textContent='';
  var low=document.createElement('span');
  low.textContent='0 glasses';
  var high=document.createElement('span');
  high.textContent=glassLabel(maxCount);
  $('wk').appendChild(low);
  $('wk').appendChild(high);
  var total=counts.reduce(function(sum,value){return sum+value},0);
  $('wksum').textContent='Last 7 days: '+glassLabel(total)+' ('+(total*250)+' ml).';
}
async function changeWater(delta){
  if(day>iso(new Date())){
    message('water-message','Water can only be logged for today or a past date.',true);
    return;
  }
  var current=waterCount(day);
  var next=current+delta;
  if(next<0||next>WATER_MAX)return;
  var previous=S.water;
  var updated=Object.assign({},previous);
  if(next===0)delete updated[day];
  else updated[day]=next;
  S.water=updated;
  if(!await save()){
    S.water=previous;
    message('water-message','Could not save water intake to your account. Check your connection and try again.',true);
    return;
  }
  message('water-message','',false);
  renderWater();
}
$('wplus').onclick=async function(){
  if(waterCount(day)>=WATER_MAX){
    message('water-message','Daily water entries are limited to 40 glasses.',true);
    return;
  }
  await changeWater(1);
};
 $('wminus').onclick=async function(){await changeWater(-1)};
async function addFood(name,kcal,meal){
  if(!name||name.length>60||!Number.isInteger(kcal)||kcal<1||kcal>5000||
     ['Breakfast','Lunch','Dinner','Snack'].indexOf(meal)===-1)return false;
  var items=S.foods[day]||[];
  var updated=items.concat([{id:Date.now()+Math.random(),name:name,kcal:kcal,meal:meal}]);
  S.foods[day]=updated;
  if(!await save()){
    if(items.length)S.foods[day]=items;
    else delete S.foods[day];
    return false;
  }
  renderFood();
  return true;
}
$('addfood').onclick=async function(){
  var nameInput=$('fname'),kcalInput=$('fkcal');
  var name=nameInput.value.trim(),rawKcal=kcalInput.value,kcal=Number(rawKcal);
  message('food-message','',false);
  fieldError(nameInput,'');fieldError(kcalInput,'');
  if(!name){
    message('food-message','Enter a food name.',true);fieldError(nameInput,'Enter a food name.');nameInput.focus();return;
  }
  if(name.length>60){
    message('food-message','Food names must be 60 characters or fewer.',true);fieldError(nameInput,'Food names must be 60 characters or fewer.');nameInput.focus();return;
  }
  if(rawKcal===''||!Number.isInteger(kcal)||kcal<1||kcal>5000){
    var kcalError='Enter whole calories from 1 to 5000.';
    message('food-message',kcalError,true);fieldError(kcalInput,kcalError);kcalInput.focus();return;
  }
  if(!await addFood(name,kcal,$('fmeal').value)){
    message('food-message','Could not save this food to your account. Check your connection and try again.',true);
    return;
  }
  message('food-message','Food added to today’s log.',false);
  $('fname').value='';$('fkcal').value='';$('fname').focus();
};
[['fname','food-message'],['fkcal','food-message']].forEach(function(pair){
  $(pair[0]).addEventListener('input',function(){
    fieldError($(pair[0]),'');
    message(pair[1],'',false);
  });
});
$('chips').onclick=async function(e){
  var b=e.target.closest('.chip');if(!b)return;
  var q=QUICK[b.dataset.i];
  if(await addFood(q[0],q[1],mealByHour()))message('food-message',q[0]+' added to today’s log.',false);
  else message('food-message','Could not save this food to your account. Check your connection and try again.',true);
};
$('flist').onclick=async function(e){
  var b=e.target.closest('.x');if(!b)return;
  var previous=S.foods[day]||[];
  S.foods[day]=previous.filter(function(x){return String(x.id)!==b.dataset.id});
  if(!await save()){
    S.foods[day]=previous;
    message('food-message','Could not delete this food from your account. Check your connection and try again.',true);
  }
  renderFood();
};

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
    if(hi===lo){lo-=1;hi+=1;}
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
$('wdate').max=iso(new Date());
['wkg','wdate'].forEach(function(id){
  $(id).addEventListener('input',function(){
    fieldError($(id),'');
    message('weight-message','',false);
  });
  $(id).addEventListener('change',function(){
    fieldError($(id),'');
    message('weight-message','',false);
  });
});
$('addwt').onclick=async function(){
  var weightInput=$('wkg'),dateInput=$('wdate');
  var rawKg=weightInput.value,kg=Number(rawKg),d=dateInput.value;
  message('weight-message','',false);
  fieldError(weightInput,'');fieldError(dateInput,'');
  if(rawKg===''||!isFinite(kg)||kg<20||kg>400||Math.abs(kg*10-Math.round(kg*10))>1e-8){
    var weightError='Enter a weight from 20 to 400 kg, to one decimal place.';
    message('weight-message',weightError,true);fieldError(weightInput,weightError);weightInput.focus();return;
  }
  var parsedDate=/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00'):new Date(NaN);
  if(!d||!isFinite(parsedDate.getTime())||iso(parsedDate)!==d){
    var dateError='Choose a valid date.';
    message('weight-message',dateError,true);fieldError(dateInput,dateError);dateInput.focus();return;
  }
  if(d>iso(new Date())){
    var futureError='Weight entries cannot be dated in the future.';
    message('weight-message',futureError,true);fieldError(dateInput,futureError);dateInput.focus();return;
  }
  var previous=S.weights;
  var updated=previous.filter(function(x){return x.date!==d});
  updated.push({date:d,kg:Math.round(kg*10)/10});
  S.weights=updated;
  if(!await save()){
    S.weights=previous;
    message('weight-message','Could not save this weight to your account. Check your connection and try again.',true);
    return;
  }
  weightInput.value='';
  message('weight-message','Weight saved.',false);
  renderWeight();
};
$('wlist').onclick=async function(e){
  var b=e.target.closest('.x');if(!b)return;
  var previous=S.weights;
  S.weights=S.weights.filter(function(x){return x.date!==b.dataset.d});
  if(!await save()){
    S.weights=previous;
    message('weight-message','Could not delete this weight from your account. Check your connection and try again.',true);
  }
  renderWeight();
};
['sgoal','swt'].forEach(function(id){
  $(id).addEventListener('input',function(){
    fieldError($(id),'');
    message('goals-message','',false);
  });
});
$('savegoals').onclick=async function(){
  var calorieInput=$('sgoal'),weightInput=$('swt');
  var rawCalories=calorieInput.value,rawWeight=weightInput.value;
  var calories=Number(rawCalories),goalWeight=rawWeight===''?null:Number(rawWeight);
  message('goals-message','',false);
  fieldError(calorieInput,'');fieldError(weightInput,'');
  if(rawCalories===''||!Number.isInteger(calories)||calories<800||calories>6000){
    var calorieError='Enter a whole daily calorie goal from 800 to 6000.';
    message('goals-message',calorieError,true);fieldError(calorieInput,calorieError);calorieInput.focus();return;
  }
  if(goalWeight!==null&&(!isFinite(goalWeight)||goalWeight<20||goalWeight>400||
     Math.abs(goalWeight*10-Math.round(goalWeight*10))>1e-8)){
    var goalWeightError='Enter a goal weight from 20 to 400 kg, to one decimal place, or leave it blank.';
    message('goals-message',goalWeightError,true);fieldError(weightInput,goalWeightError);weightInput.focus();return;
  }
  var previousGoal=S.goal,previousGoalWeight=S.goalWt;
  S.goal=calories;S.goalWt=goalWeight;
  if(!await save()){
    S.goal=previousGoal;S.goalWt=previousGoalWeight;
    message('goals-message','Could not save your goals to your account. Check your connection and try again.',true);
    return;
  }
  message('goals-message','Goals saved.',false);
  renderWeight();renderFood();
};
var scanInput=$('scan');
var scanStatus=$('sres');
var scanPicker=scanInput.parentElement;
var scanPreviewUrl=null;
function scanMessage(message,isError){
  scanStatus.textContent=message;
  scanStatus.className='scan-status'+(isError?' err':'');
}
function resizePhoto(file){
  return createImageBitmap(file).then(function(bitmap){
    var scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    var canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    return new Promise(function(resolve,reject){
      canvas.toBlob(function(blob){
        if(blob)resolve(blob);
        else reject(new Error('Could not prepare this photo. Try another image.'));
      },'image/jpeg',0.82);
    });
  });
}
function blobDataUrl(blob){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(){resolve(reader.result)};
    reader.onerror=function(){reject(new Error('Could not read this photo.'))};
    reader.readAsDataURL(blob);
  });
}
function getAuthHeaders(){
  return supabaseClient.auth.getSession().then(function(result){
    if(result.error)throw result.error;
    if(!result.data.session)throw new Error('Sign in again to use this feature.');
    return {Authorization:'Bearer '+result.data.session.access_token};
  });
}
async function addScanFood(item,button){
  var name=item.nameInput.value.trim();
  var kcal=Number(item.kcalInput.value);
  if(!name||name.length>60||!Number.isInteger(kcal)||kcal<1||kcal>5000){
    item.feedback.textContent='Enter a food name and calories from 1 to 5000.';
    item.feedback.className='err';
    return;
  }
  if(!await addFood(name,kcal,$('fmeal').value)){
    item.feedback.textContent='Could not save this food to your account. Check your connection and try again.';
    item.feedback.className='err';
    return;
  }
  button.disabled=true;
  button.textContent='Added';
  item.feedback.textContent='Added to today’s log.';
  item.feedback.className='scan-notes';
}
function showScanResults(result,previewUrl){
  scanStatus.textContent='';
  scanStatus.className='scan-status';
  if(previewUrl){
    var image=document.createElement('img');
    image.className='scan-preview';
    image.src=previewUrl;
    image.alt='Photo analyzed for food';
    scanStatus.appendChild(image);
  }
  var notes=document.createElement('p');
  notes.className='scan-notes';
  notes.textContent=result.notes||'Review the estimates; photo-based portions can be inaccurate.';
  scanStatus.appendChild(notes);
  if(!result.foods.length){
    var empty=document.createElement('p');
    empty.className='empty';
    empty.textContent='No food could be identified. Try a clearer photo or add the food manually.';
    scanStatus.appendChild(empty);
    return;
  }
  result.foods.forEach(function(food,index){
    var row=document.createElement('div');
    row.className='scan-item';
    var nameLabel=document.createElement('label');
    nameLabel.className='scan-name';
    nameLabel.textContent='Food';
    var nameInput=document.createElement('input');
    nameInput.type='text';
    nameInput.maxLength=60;
    nameInput.value=food.name;
    nameInput.setAttribute('aria-label','Food name '+(index+1));
    nameLabel.appendChild(nameInput);
    var portion=document.createElement('span');
    portion.className='scan-notes';
    portion.textContent='Estimated portion: '+food.portion;
    var kcalLabel=document.createElement('label');
    kcalLabel.textContent='Calories (kcal)';
    var kcalInput=document.createElement('input');
    kcalInput.type='number';
    kcalInput.inputMode='numeric';
    kcalInput.min='1';
    kcalInput.max='5000';
    kcalInput.step='1';
    kcalInput.value=food.calories;
    kcalInput.setAttribute('aria-label','Calories for '+food.name);
    kcalLabel.appendChild(kcalInput);
    var button=document.createElement('button');
    button.type='button';
    button.className='btn';
    button.textContent='Add';
    var feedback=document.createElement('span');
    feedback.setAttribute('role','status');
    var item={nameInput:nameInput,kcalInput:kcalInput,feedback:feedback};
    button.onclick=function(){addScanFood(item,button)};
    row.appendChild(nameLabel);
    row.appendChild(portion);
    row.appendChild(kcalLabel);
    row.appendChild(button);
    row.appendChild(feedback);
    scanStatus.appendChild(row);
  });
}
scanInput.onchange=function(){
  var file=scanInput.files&&scanInput.files[0];
  scanInput.value='';
  if(!file)return;
  if(!file.type||file.type.indexOf('image/')!==0||file.size>15*1024*1024){
    scanMessage('Choose an image smaller than 15 MB.',true);
    return;
  }
  if(scanPreviewUrl){URL.revokeObjectURL(scanPreviewUrl);scanPreviewUrl=null}
  scanStatus.textContent='';
  scanStatus.className='scan-status';
  scanPicker.setAttribute('aria-disabled','true');
  scanInput.disabled=true;
  scanMessage('Preparing photo and asking AI to estimate the food…');
  resizePhoto(file).then(function(blob){
    if(blob.size>3*1024*1024)throw new Error('This photo is still too large to scan. Choose a smaller image.');
    scanPreviewUrl=URL.createObjectURL(blob);
    return blobDataUrl(blob);
  }).then(function(image){
    return getAuthHeaders().then(function(headers){
      headers['Content-Type']='application/json';
      return fetch('/api/scan',{
        method:'POST',
        headers:headers,
        body:JSON.stringify({image:image})
      });
    });
  }).then(function(response){
    return response.json().catch(function(){
      throw new Error('The scan service returned an invalid response.');
    }).then(function(data){
      if(!response.ok)throw new Error(data.error||'Could not scan this photo.');
      return data;
    });
  }).then(function(result){
    showScanResults(result,scanPreviewUrl);
  }).catch(function(error){
    if(scanPreviewUrl){URL.revokeObjectURL(scanPreviewUrl);scanPreviewUrl=null}
    scanMessage(error.message||'Could not scan this photo. Try again or add the food manually.',true);
  }).then(function(){
    scanPicker.setAttribute('aria-disabled','false');
    scanInput.disabled=false;
  });
};

var chatHistory=[];
var chatPrompts=['How can I build a balanced meal?','How does my calorie goal work?','Give me a simple meal idea.'];
var chatInput=$('cin');
var chatSend=$('csend');
var chatMessages=$('msgs');
var chatChips=$('cchips');
chatChips.innerHTML=chatPrompts.map(function(prompt,index){
  return '<button class="chip" type="button" data-prompt="'+index+'">'+esc(prompt)+'</button>';
}).join('');
function addChatMessage(text,role){
  var bubble=document.createElement('div');
  bubble.className='msg '+role;
  bubble.textContent=text;
  chatMessages.appendChild(bubble);
  bubble.scrollIntoView({block:'nearest'});
  return bubble;
}
function coachContext(){
  var foods=S.foods[day]||[];
  var latest=sorted().slice(-1)[0];
  return {
    dailyCalories:S.goal,
    caloriesEaten:foods.reduce(function(total,item){return total+item.kcal},0),
    latestWeight:latest?latest.kg:null,
    goalWeight:S.goalWt,
    waterGlasses:waterCount(day)
  };
}
function sendChatMessage(text){
  text=(text||'').trim();
  if(!text||text.length>300||chatSend.disabled)return;
  if(window.location.protocol==='file:'){
    addChatMessage('The coach needs the app server. In PowerShell, open the project folder, run npm start, then open http://localhost:3000.','error');
    return;
  }
  chatInput.value='';
  addChatMessage(text,'user');
  chatSend.disabled=true;
  chatInput.disabled=true;
  chatSend.textContent='Sending…';
  var messages=chatHistory.concat([{role:'user',content:text}]).slice(-12);
  var context=coachContext();
  getAuthHeaders().then(function(headers){
    headers['Content-Type']='application/json';
    return fetch('/api/chat',{
      method:'POST',
      headers:headers,
      body:JSON.stringify({messages:messages,context:context})
    });
  }).then(function(response){
    return response.json().catch(function(){
      throw new Error('The coach returned an invalid response.');
    }).then(function(data){
      if(!response.ok)throw new Error(data.error||'Could not send your message.');
      return data;
    });
  }).then(function(data){
    if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('The coach returned an empty response. Please try again.');
    chatHistory=messages.concat([{role:'assistant',content:data.reply}]).slice(-12);
    addChatMessage(data.reply,'bot');
  }).catch(function(error){
    addChatMessage(error.message||'Could not reach the coach. Please try again.','error');
  }).then(function(){
    chatSend.disabled=false;
    chatInput.disabled=false;
    chatSend.textContent='Send';
    chatInput.focus();
  });
}
chatSend.onclick=function(){sendChatMessage(chatInput.value)};
chatInput.addEventListener('keydown',function(event){
  if(event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();
    sendChatMessage(chatInput.value);
  }
});
chatChips.onclick=function(event){
  var button=event.target.closest('button[data-prompt]');
  if(!button)return;
  sendChatMessage(chatPrompts[Number(button.dataset.prompt)]);
};
function hideTracker(){
  $('tabs').hidden=true;
  $('onb').hidden=true;
  $('p-food').hidden=true;
  $('p-wt').hidden=true;
  $('p-coach').hidden=true;
}
function legacyState(){
  try{
    var raw=localStorage.getItem(KEY);
    if(!raw)return null;
    var state=normalizeState(JSON.parse(raw));
    return state.setupComplete||Object.keys(state.foods).length||state.weights.length||Object.keys(state.water).length?state:null;
  }catch(error){
    console.error('Unable to read existing browser tracker data:',error);
    return null;
  }
}
async function loadAccount(user,generation){
  $('app-loading').hidden=false;
  $('loading-message').textContent='Loading your tracker…';
  $('retry-load').hidden=true;
  hideTracker();
  var result=await supabaseClient.from('tracker_data').select('data').eq('user_id',user.id).maybeSingle();
  if(result.error)throw result.error;
  if(generation!==accountGeneration)return;
  if(result.data){
    S=normalizeState(result.data.data);
  }else{
    var oldState=importLegacyOnFirstLogin?legacyState():null;
    S=oldState||defaultState();
    if(!await save())throw new Error('Could not create your tracker record in Supabase.');
    if(oldState)message('sync-status','Imported this browser’s saved tracker into your account.',false);
  }
  if(generation!==accountGeneration)return;
  loadedUserId=user.id;
  loadingUserId=null;
  $('app-loading').hidden=true;
  $('auth').hidden=true;
  $('account-bar').hidden=false;
  $('account-email').textContent=user.email||'Signed in';
  $('onb').hidden=S.setupComplete;
  $('tabs').hidden=!S.setupComplete;
  $('p-food').hidden=!S.setupComplete;
  $('p-wt').hidden=true;
  $('p-coach').hidden=true;
  $('wdate').value=iso(new Date());
  day=iso(new Date());
  if(S.setupComplete)tab('food');
  message('sync-status','Connected to your Supabase account.',false);
  updateSuggestion();
  renderFood();
  renderWeight();
}
async function handleSession(session){
  var user=session&&session.user?session.user:null;
  if(!user){
    accountGeneration++;
    currentUser=null;
    loadedUserId=null;
    loadingUserId=null;
    S=defaultState();
    hideTracker();
    $('auth').hidden=false;
    $('account-bar').hidden=true;
    $('app-loading').hidden=true;
    message('sync-status','',false);
    return;
  }
  if(currentUser&&currentUser.id===user.id&&(loadedUserId===user.id||loadingUserId===user.id))return;
  accountGeneration++;
  var generation=accountGeneration;
  currentUser=user;
  loadedUserId=null;
  loadingUserId=user.id;
  S=defaultState();
  $('auth').hidden=true;
  $('account-bar').hidden=false;
  $('account-email').textContent=user.email||'Signed in';
  $('app-loading').hidden=false;
  $('loading-message').textContent='Loading your tracker…';
  $('retry-load').hidden=true;
  hideTracker();
  try{
    await loadAccount(user,generation);
  }catch(error){
    console.error('Unable to load tracker data from Supabase:',error);
    if(generation!==accountGeneration)return;
    loadingUserId=null;
    $('app-loading').hidden=false;
    $('loading-message').textContent='Could not load your tracker. Confirm the Supabase table and row security are set up, then retry. '+error.message;
    $('retry-load').hidden=false;
    message('sync-status','Your tracker data has not been loaded.',true);
  }
}
async function authenticate(action){
  if(!supabaseClient){
    message('auth-status','Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then restart the server.',true);
    return;
  }
  if(!$('auth-form').reportValidity())return;
  var email=$('auth-email').value.trim();
  var password=$('auth-password').value;
  $('sign-in').disabled=true;
  $('sign-up').disabled=true;
  message('auth-status',action==='signup'?'Creating your account…':'Signing in…',false);
  importLegacyOnFirstLogin=$('import-legacy').checked;
  try{
    var result=action==='signup'
      ?await supabaseClient.auth.signUp({email:email,password:password})
      :await supabaseClient.auth.signInWithPassword({email:email,password:password});
    if(result.error)throw result.error;
    if(action==='signup'&&!result.data.session){
      message('auth-status','Check your email to confirm your account, then return here to sign in.',false);
    }else{
      message('auth-status','Signed in. Loading your private tracker…',false);
    }
  }catch(error){
    message('auth-status',error.message||'Could not authenticate. Check your email, password, and Supabase settings.',true);
  }finally{
    $('sign-in').disabled=false;
    $('sign-up').disabled=false;
  }
}
async function initializeAuth(){
  $('auth-form').onsubmit=function(event){event.preventDefault();authenticate('signin')};
  $('sign-in').onclick=function(){authenticate('signin')};
  $('sign-up').onclick=function(){authenticate('signup')};
  $('sign-out').onclick=async function(){
    $('sign-out').disabled=true;
    try{
      var result=await supabaseClient.auth.signOut();
      if(result.error)message('sync-status','Could not sign out: '+result.error.message,true);
    }catch(error){
      message('sync-status','Could not sign out: '+error.message,true);
    }finally{
      $('sign-out').disabled=false;
    }
  };
  $('retry-load').onclick=function(){
    if(currentUser)handleSession({user:currentUser});
  };
  try{
    var response=await fetch('/api/config',{cache:'no-store'});
    if(!response.ok)throw new Error('Could not load the app configuration.');
    var config=await response.json();
    if(!config.supabaseUrl||!config.supabaseAnonKey){
      message('auth-status','Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY, then restart the server.',true);
      return;
    }
    if(!window.supabase||typeof window.supabase.createClient!=='function'){
      throw new Error('Could not load the Supabase client library. Check your internet connection and refresh.');
    }
    supabaseClient=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
    supabaseClient.auth.onAuthStateChange(function(event,session){
      if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].indexOf(event)!==-1){
        window.setTimeout(function(){handleSession(session)},0);
      }
    });
    var result=await supabaseClient.auth.getSession();
    if(result.error)throw result.error;
    await handleSession(result.data.session);
  }catch(error){
    console.error('Unable to initialize Supabase authentication:',error);
    message('auth-status',error.message||'Could not connect to Supabase.',true);
  }
}
updateSuggestion();
initializeAuth();
})();
